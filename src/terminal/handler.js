/**
 * Terminal Input Handler for X-Asena
 * Handles keyboard shortcuts for admin actions
 * 
 * Shortcuts:
 * - Q: Logout and clear auth state
 * - R: Restart the bot
 * - A: Wipe entire database
 */

import readline from "readline";
import { clearAuthState } from "../database/authState.js";
import config from "../../config.js";

let connection = null;

/**
 * Set the active connection instance
 * @param {object} conn - Baileys connection instance
 */
export function setConnection(conn) {
    connection = conn;
}

/**
 * Logout and clear authentication state
 */
async function logout() {
    console.log("\n🔄 Logging out...");
    
    try {
        // Close the connection if active
        if (connection) {
            await connection.logout();
            console.log("✅ Connection closed");
        }
        
        // Clear authentication state from database
        const count = await clearAuthState();
        console.log(`✅ Cleared ${count} auth state records`);
        
        console.log("✅ Logout complete! The bot will restart...\n");
        
        // Exit to trigger restart (if using nodemon or similar)
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Error during logout:", error);
        console.log("⚠️ Force exiting...");
        process.exit(1);
    }
}

/**
 * Restart the bot without clearing auth state
 */
async function restart() {
    console.log("\n🔄 Restarting bot...");
    
    try {
        // Close the connection if active
        if (connection) {
            try {
                await connection.end();
                console.log("✅ Connection closed gracefully");
            } catch (error) {
                console.log("⚠️ Connection already closed or error:", error.message);
            }
        }
        
        console.log("✅ Restart initiated...\n");
        
        // Exit to trigger restart (nodemon will auto-restart)
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Error during restart:", error);
        console.log("⚠️ Force exiting...");
        process.exit(1);
    }
}

/**
 * Wipe entire database
 */
async function wipeDatabase() {
    console.log("\n⚠️  DATABASE WIPE INITIATED");
    console.log("⏳ Dropping all tables...");
    
    try {
        // Force sync with alter to drop all tables
        await config.DATABASE.drop();
        console.log("✅ All tables dropped");
        
        // Recreate tables
        await config.DATABASE.sync();
        console.log("✅ Tables recreated");
        
        console.log("✅ Database wiped successfully!\n");
        console.log("⚠️  Please restart the bot manually.\n");
        
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Error wiping database:", error);
        process.exit(1);
    }
}

/**
 * Initialize terminal input handler
 */
export function initTerminalHandler() {
    console.log("\n📝 Terminal shortcuts enabled:");
    console.log("   Type 'Q' + Enter - Logout and clear auth state");
    console.log("   Type 'R' + Enter - Restart the bot");
    console.log("   Type 'A' + Enter - Wipe entire database");
    console.log("   Press Ctrl+C - Exit\n");
    
    // Set up stdin to receive input
    process.stdin.setEncoding('utf8');
    
    // Resume stdin in case it was paused
    if (process.stdin.isTTY) {
        process.stdin.resume();
    }
    
    process.stdin.on('data', async (data) => {
        const input = data.toString().trim().toUpperCase();
        
        // Debug: show what was received
        console.log(`[DEBUG] Received input: "${input}"`);
        
        // Handle Q - Logout
        if (input === 'Q') {
            console.log("✅ Q detected - Logging out...");
            await logout();
        }
        
        // Handle R - Restart
        else if (input === 'R') {
            console.log("✅ R detected - Restarting...");
            await restart();
        }
        
        // Handle A - Wipe Database
        else if (input === 'A') {
            console.log("✅ A detected - Database wipe requested");
            console.log("\n⚠️  WARNING: This will DELETE ALL DATABASE DATA!");
            console.log("⚠️  Type 'Y' and press Enter to confirm, or anything else to cancel: ");
            
            // Wait for confirmation
            const confirmListener = async (confirmData) => {
                process.stdin.removeListener('data', confirmListener);
                const confirm = confirmData.toString().trim().toUpperCase();
                console.log(`[DEBUG] Confirmation input: "${confirm}"`);
                
                if (confirm === 'Y') {
                    await wipeDatabase();
                } else {
                    console.log("❌ Database wipe cancelled.\n");
                }
            };
            
            process.stdin.once('data', confirmListener);
        }
        else if (input.length > 0) {
            console.log(`⚠️  Unknown command: "${input}". Valid commands: Q, R, A`);
        }
    });
    
    // Handle process termination
    process.on("SIGINT", async () => {
        console.log("\n👋 Shutting down...");
        
        if (connection) {
            try {
                await connection.end();
            } catch (error) {
                // Ignore errors during shutdown
            }
        }
        
        process.exit(0);
    });
}
