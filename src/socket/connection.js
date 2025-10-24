import makeWASocket, {
  fetchLatestBaileysVersion
} from "baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { useMultiDbAuthState } from "../database/authState.js"; 

const logger = pino({ level: "info" });

async function connect() {
  const { state, saveCreds } = await useMultiDbAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: state.keys
    },
    version,
  });

  conn.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info("Scan the QR code above to log in.");
    }

    if (connection === "open") {
      logger.info("✅ Connected successfully!");
    }

    if (connection === "close") {
      logger.warn("❌ Connection closed. Attempting reconnect...");
      connect();
    }
  });

  conn.ev.on("creds.update", saveCreds);

  conn.ev.on("messages.upsert", (m) => {
    console.log("📩 Message:", JSON.stringify(m, null, 2));
  });
}

export default connect;