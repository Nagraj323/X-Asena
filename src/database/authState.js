import { Mutex } from 'async-mutex';
import config from "../../config.js";
import { DataTypes } from "sequelize";
import { initAuthCreds, proto } from 'baileys';

/**
 * Configuration for retry mechanism
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 100, // ms
    backoffMultiplier: 2
};

/**
 * We need to lock database operations due to async nature
 * https://github.com/WhiskeySockets/Baileys/issues/794
 * Use a Map to store mutexes for each database key
 */
const dbLocks = new Map();

/**
 * Get or create a mutex for a specific database key
 * Ensures thread-safe operations on individual keys
 */
const getDbLock = (key) => {
    let mutex = dbLocks.get(key);
    if (!mutex) {
        mutex = new Mutex();
        dbLocks.set(key, mutex);
    }
    return mutex;
};

/**
 * Define the AuthState model for storing authentication data
 * Uses TEXT type for maximum compatibility and storage of large JSON objects
 */
const AuthStateDB = config.DATABASE.define("AuthState", {
    key: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 500]
        }
    },
    value: {
        type: DataTypes.TEXT('long'), // Support for large data
        allowNull: true,
    },
}, {
    indexes: [
        {
            fields: ['key'],
            unique: true
        }
    ],
    timestamps: true, // Track when records are created/updated
});

/**
 * Enhanced BufferJSON utility for handling buffers in JSON
 * Properly serializes and deserializes Buffer objects
 */
const BufferJSON = {
    replacer: (key, value) => {
        // Handle Buffer objects
        if (value instanceof Buffer) {
            return {
                type: 'Buffer',
                data: value.toString('base64')
            };
        }
        // Handle plain objects that look like Buffers
        if (value?.type === 'Buffer' && Array.isArray(value?.data)) {
            return {
                type: 'Buffer',
                data: Buffer.from(value.data).toString('base64')
            };
        }
        // Handle Uint8Array (common in crypto operations)
        if (value instanceof Uint8Array) {
            return {
                type: 'Buffer',
                data: Buffer.from(value).toString('base64')
            };
        }
        return value;
    },
    
    reviver: (key, value) => {
        if (value?.type === 'Buffer' && typeof value?.data === 'string') {
            try {
                return Buffer.from(value.data, 'base64');
            } catch (error) {
                console.error(`Failed to parse Buffer for key ${key}:`, error);
                return value;
            }
        }
        return value;
    }
};

/**
 * Retry mechanism for database operations
 * Implements exponential backoff for transient failures
 */
const retryOperation = async (operation, context = '') => {
    let lastError;
    
    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Don't retry on certain errors
            if (error.name === 'SequelizeValidationError' || 
                error.name === 'SequelizeUniqueConstraintError') {
                throw error;
            }
            
            // If this isn't the last attempt, wait before retrying
            if (attempt < RETRY_CONFIG.maxRetries - 1) {
                const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
                console.warn(`${context} failed (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    console.error(`${context} failed after ${RETRY_CONFIG.maxRetries} attempts:`, lastError);
    throw lastError;
};

/**
 * Sanitize key names to prevent issues with special characters
 */
const sanitizeKey = (key) => {
    if (!key) return key;
    // Replace problematic characters but keep the structure
    return key.replace(/[<>:"|?*]/g, '_').replace(/\//g, '__').replace(/:/g, '-');
};

/**
 * Database-based authentication state storage
 * Production-ready implementation with proper error handling and retry logic
 * 
 * This implementation follows the same pattern as Baileys' useMultiFileAuthState
 * but uses a database for storage, making it suitable for:
 * - Production deployments
 * - Distributed systems
 * - Containerized environments
 * - Multi-instance bots
 */
export const useMultiDbAuthState = async () => {
    /**
     * Write data to database with proper error handling and retries
     */
    const writeData = async (data, key) => {
        const sanitizedKey = sanitizeKey(key);
        const mutex = getDbLock(sanitizedKey);
        
        return mutex.acquire().then(async (release) => {
            try {
                return await retryOperation(async () => {
                    const jsonData = JSON.stringify(data, BufferJSON.replacer);
                    
                    // Use upsert for better performance and atomicity
                    await AuthStateDB.upsert({
                        key: sanitizedKey,
                        value: jsonData
                    });
                }, `writeData(${key})`);
            } catch (error) {
                console.error(`Failed to write data for key ${key}:`, error.message);
                throw error;
            } finally {
                release();
            }
        });
    };

    /**
     * Read data from database with proper error handling
     */
    const readData = async (key) => {
        const sanitizedKey = sanitizeKey(key);
        const mutex = getDbLock(sanitizedKey);
        
        return await mutex.acquire().then(async (release) => {
            try {
                return await retryOperation(async () => {
                    const record = await AuthStateDB.findOne({ 
                        where: { key: sanitizedKey },
                        attributes: ['value'],
                        raw: true
                    });
                    
                    if (!record || !record.value) {
                        return null;
                    }
                    
                    try {
                        return JSON.parse(record.value, BufferJSON.reviver);
                    } catch (parseError) {
                        console.error(`Failed to parse JSON for key ${key}:`, parseError);
                        return null;
                    }
                }, `readData(${key})`);
            } catch (error) {
                // Don't throw on read errors, just log and return null
                console.error(`Failed to read data for key ${key}:`, error.message);
                return null;
            } finally {
                release();
            }
        });
    };

    /**
     * Remove data from database
     */
    const removeData = async (key) => {
        const sanitizedKey = sanitizeKey(key);
        const mutex = getDbLock(sanitizedKey);
        
        return mutex.acquire().then(async (release) => {
            try {
                return await retryOperation(async () => {
                    await AuthStateDB.destroy({ 
                        where: { key: sanitizedKey } 
                    });
                }, `removeData(${key})`);
            } catch (error) {
                // Don't throw on delete errors, just log
                console.error(`Failed to remove data for key ${key}:`, error.message);
            } finally {
                release();
            }
        });
    };

    // Initialize or load existing credentials
    let creds = await readData('creds.json');
    
    if (!creds) {
        console.log('No existing credentials found, initializing new auth state...');
        creds = initAuthCreds();
        // Save initial credentials
        await writeData(creds, 'creds.json');
    }

    return {
        state: {
            creds,
            keys: {
                /**
                 * Get multiple keys of a specific type
                 * Handles batch retrieval efficiently
                 */
                get: async (type, ids) => {
                    const data = {};
                    
                    // Process in parallel for better performance
                    await Promise.all(
                        ids.map(async (id) => {
                            try {
                                let value = await readData(`${type}-${id}.json`);
                                
                                // Handle special case for app-state-sync-key
                                // Convert plain object to proto format
                                if (type === 'app-state-sync-key' && value) {
                                    try {
                                        value = proto.Message.AppStateSyncKeyData.fromObject(value);
                                    } catch (protoError) {
                                        console.error(`Failed to convert app-state-sync-key for id ${id}:`, protoError);
                                    }
                                }
                                
                                data[id] = value;
                            } catch (error) {
                                console.error(`Failed to get key ${type}-${id}:`, error);
                                data[id] = null;
                            }
                        })
                    );
                    
                    return data;
                },
                
                /**
                 * Set multiple keys
                 * Handles batch writes efficiently with proper error isolation
                 */
                set: async (data) => {
                    const tasks = [];
                    
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}.json`;
                            
                            // Create isolated task that won't fail the entire batch
                            const task = (async () => {
                                try {
                                    if (value) {
                                        await writeData(value, key);
                                    } else {
                                        await removeData(key);
                                    }
                                } catch (error) {
                                    console.error(`Failed to set key ${key}:`, error);
                                    // Don't throw, just log - partial success is acceptable
                                }
                            })();
                            
                            tasks.push(task);
                        }
                    }
                    
                    // Wait for all operations to complete
                    await Promise.all(tasks);
                }
            }
        },
        
        /**
         * Save credentials to database
         * Called automatically when credentials are updated
         */
        saveCreds: async () => {
            try {
                return await writeData(creds, 'creds.json');
            } catch (error) {
                console.error('Failed to save credentials:', error);
                throw error; // Credentials save failures should be fatal
            }
        }
    };
};

/**
 * Utility function to clear all auth state
 * Useful for logout or session reset
 */
export const clearAuthState = async () => {
    try {
        const count = await AuthStateDB.destroy({
            where: {},
            truncate: true
        });
        console.log(`Cleared ${count} auth state records`);
        return count;
    } catch (error) {
        console.error('Failed to clear auth state:', error);
        throw error;
    }
};

export { AuthStateDB };