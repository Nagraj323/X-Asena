import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore
} from "baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import fs from "fs/promises";
import { useMultiDbAuthState } from "../database/authState.js";
import { serialize } from "../messages/serialize.js";
import { messageHandler } from "../messages/handler.js";
import { setConnection } from "../terminal/handler.js";

const logger = pino({ level: "silent" }); // Changed from "error" to "silent" to reduce noise

// Store connection instance globally for terminal handler
let globalConnection = null;

async function connect() {
    const { state, saveCreds } = await useMultiDbAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        version,
        // Message retry configuration
        getMessage: async (key) => {
            // Return undefined to tell Baileys we don't have the message
            // This prevents errors when trying to decrypt quoted messages
            return undefined;
        },
        // Ignore broadcast messages and status updates to reduce errors
        shouldIgnoreJid: (jid) => {
            return jid === 'status@broadcast';
        },
        // Mark messages as read automatically to sync properly
        markOnlineOnConnect: true,
    });

    // Store connection globally for terminal handler access
    globalConnection = conn;
    setConnection(conn);

    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log("\n📱 Scan the QR code above to log in.\n");
        }

        if (connection === "open") {
            console.log("✅ Connected successfully!");
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log("❌ Connection closed. Attempting reconnect...");
                connect();
            } else {
                console.log("🔓 Logged out. Please restart the bot to login again.");
            }
        }
    });

    conn.ev.on("creds.update", saveCreds);

    // Handle LID (Local Identifier) mapping updates - New in Baileys 7.x
    conn.ev.on("lid-mapping.update", (mapping) => {
        console.log("🔄 LID mapping updated:", Object.keys(mapping).length, "mappings");
        // The mapping is automatically stored by the auth state
    });

    // Handle message decryption errors gracefully
    conn.ev.on("messages.update", (updates) => {
        for (const update of updates) {
            // Log message updates for debugging
            if (update.update?.messageStubType) {
                console.log("📝 Message stub update:", update.key.id, update.update.messageStubType);
            }
        }
    });

    // Handle connection errors
    conn.ev.on("connection.update", (update) => {
        if (update.lastDisconnect?.error) {
            const error = update.lastDisconnect.error;
            console.error("⚠️ Connection error:", error.message || error);
        }
    });

    conn.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            
            // Skip if message is empty or has issues
            if (!msg || !msg.message) {
                return;
            }

            // Skip broadcast messages
            if (msg.key?.remoteJid === 'status@broadcast') {
                return;
            }

            // Serialize and handle the message
            const message = await serialize(msg, conn);
            if (message) {
                await messageHandler({ message, conn });
            }
        } catch (error) {
            // Don't crash on message handling errors
            console.error("❌ Error processing message:", error.message);
            
            // Log the message key for debugging
            if (m.messages[0]?.key) {
                const key = m.messages[0].key;
                console.error("   Message Key:", {
                    remoteJid: key.remoteJid,
                    participant: key.participant,
                    id: key.id,
                    participantAlt: key.participantAlt
                });
            }
        }
    });

    return conn;
}

/**
 * Get the current connection instance
 * @returns {object|null} Current Baileys connection
 */
export function getConnection() {
    return globalConnection;
}

export default connect;