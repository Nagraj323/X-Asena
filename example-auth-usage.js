/**
 * Example: Using Database Authentication State
 * 
 * This example shows how to use the simplified database-based authentication state
 * without session IDs, similar to the file-based approach.
 */

import makeWASocket from 'baileys';
import { 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    DisconnectReason 
} from 'baileys';
import { useMultiDbAuthState, clearAuthState } from './src/database/authState.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

async function connectToWhatsApp() {
    // Load authentication state from database
    const { state, saveCreds } = await useMultiDbAuthState();
    
    // Get latest WhatsApp version
    const { version } = await fetchLatestBaileysVersion();

    // Create socket connection
    const conn = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        version,
        printQRInTerminal: true, // Show QR in terminal
    });

    // Save credentials whenever they're updated
    conn.ev.on('creds.update', saveCreds);

    // Handle connection updates
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Scan the QR code to login');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log('Connection closed, reconnecting...');
                connectToWhatsApp();
            } else {
                console.log('Logged out, clearing auth state...');
                await clearAuthState();
            }
        }

        if (connection === 'open') {
            console.log('Connected successfully!');
        }
    });

    // Handle incoming messages
    conn.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text;

        console.log('Received message:', text);

        // Example: Echo bot
        if (text === '!ping') {
            await conn.sendMessage(msg.key.remoteJid, { 
                text: 'Pong!' 
            });
        }
    });

    return conn;
}

// Start the bot
connectToWhatsApp().catch(console.error);

/**
 * UTILITY FUNCTIONS
 */

// Function to logout and clear auth state
async function logout() {
    try {
        await clearAuthState();
        console.log('Auth state cleared successfully');
        process.exit(0);
    } catch (error) {
        console.error('Failed to clear auth state:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});

// Export for use in other modules
export { connectToWhatsApp, logout };
