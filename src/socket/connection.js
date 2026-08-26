/**
 * WhatsApp socket connection — Baileys 7.0.0-rc13
 * QR / Pairing-code login
 * + Chain Reply support
 */

import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from "baileys";

import pino from "pino";
import qrcode from "qrcode-terminal";

import { useMultiDbAuthState } from "../database/authState.js";
import { serialize } from "../messages/serialize.js";
import {
  messageHandler,
  saveChainReply,
} from "../messages/handler.js";

import { setConnection } from "../terminal/handler.js";
import {
  groupCache,
  msgCache,
} from "../utils/cache.js";

import {
  startReminderScheduler,
  stopReminderScheduler,
} from "../utils/reminders.js";

import { processGroupGuards } from "../messages/groupGuards.js";

import { attachGroupParticipantEvents } from "../events/groupParticipants.js";

const logger = pino({
  level:
    process.env.BAILEYS_LOG_LEVEL ||
    "silent",
});

let globalConnection = null;
let reconnectAttempt = 0;
let isConnecting = false;
let cachedVersion = null;

const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

/* =========================================================
   BACKOFF
   ========================================================= */

function backoffDelay(attempt) {

  const exp = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * 2 ** attempt
  );

  const jitter =
    Math.floor(
      Math.random() * 500
    );

  return exp + jitter;
}

/* =========================================================
   VERSION
   ========================================================= */

async function getVersion() {

  if (cachedVersion)
    return cachedVersion;

  try {

    const { version } =
      await fetchLatestBaileysVersion();

    cachedVersion = version;

  } catch {

    cachedVersion = undefined;
  }

  return cachedVersion;
}

/* =========================================================
   CLEANUP
   ========================================================= */

function cleanupSocket(conn) {

  if (!conn) return;

  try {
    conn.ev?.removeAllListeners?.();
  } catch {}

  try {
    conn.ws?.close?.();
  } catch {}

  try {
    conn.end?.(undefined);
  } catch {}
}

/* =========================================================
   PAIRING NUMBER
   ========================================================= */

function pairingNumber() {

  const raw =
    (
      process.env.PAIRING_NUMBER ||
      ""
    ).replace(/\D/g, "");

  return raw || null;
}

/* =========================================================
   CONNECT
   ========================================================= */

async function connect() {

  if (isConnecting)
    return globalConnection;

  isConnecting = true;

  let conn = null;

  try {

    const {
      state,
      saveCreds,
    } =
      await useMultiDbAuthState();

    const version =
      await getVersion();

    const hasSession =
      !!(
        state.creds?.me ||
        state.creds?.registered
      );

    const usePairing =
      !hasSession &&
      !!pairingNumber();

    /* =====================================================
       SOCKET OPTIONS
       ===================================================== */

    const socketOptions = {

      logger,

      auth: {
        creds:
          state.creds,

        keys:
          makeCacheableSignalKeyStore(
            state.keys,
            logger
          ),
      },

      syncFullHistory: false,

      shouldSyncHistoryMessage:
        () => false,

      markOnlineOnConnect:
        false,

      generateHighQualityLinkPreview:
        false,

      emitOwnEvents:
        false,

      shouldIgnoreJid:
        (jid) =>
          !jid ||
          jid === "status@broadcast" ||
          jid.endsWith("@broadcast"),

      getMessage:
        async (key) => {

          const id =
            key?.id;

          if (!id)
            return undefined;

          return (
            msgCache.get(id) ||
            undefined
          );
        },

      cachedGroupMetadata:
        async (jid) =>
          groupCache.get(jid),
    };

    if (version) {
      socketOptions.version =
        version;
    }

    conn =
      makeWASocket(
        socketOptions
      );

    globalConnection =
      conn;

    setConnection(conn);

    /* =====================================================
       PAIRING
       ===================================================== */

    if (usePairing) {

      setTimeout(
        async () => {

          try {

            const code =
              await conn.requestPairingCode(
                pairingNumber()
              );

            console.log(
              "\n🔗 Pairing code (enter on phone):\n"
            );

            console.log(
              `   ${code}\n`
            );

            console.log(
              "Phone → Linked devices → Link with phone number\n"
            );

          } catch (err) {

            console.error(
              "Pairing code failed:",
              err?.message || err
            );

            console.log(
              "Scan QR instead if it appears...\n"
            );
          }

        },
        2000
      );
    }

    /* =====================================================
       CONNECTION UPDATE
       ===================================================== */

    conn.ev.on(
      "connection.update",
      async (update) => {

        const {
          connection,
          lastDisconnect,
          qr,
        } = update;

        if (
          qr &&
          !usePairing
        ) {

          qrcode.generate(
            qr,
            { small: true }
          );

          console.log(
            "\n📱 Scan the QR code above to log in.\n"
          );

          console.log(
            "(Or set PAIRING_NUMBER=yourNumberWithCountryCode and restart)\n"
          );
        }

        /* =================================================
           OPEN
           ================================================= */

        if (
          connection === "open"
        ) {

          reconnectAttempt = 0;

          console.log(
            "✅ Connected successfully!"
          );

          startReminderScheduler(
            conn
          );

          setTimeout(
            async () => {

              try {

                const {
                  ensureLogGroup,
                  attachLogGroupConn,
                  systemLog,
                } =
                  await import(
                    "../utils/logGroup.js"
                  );

                const {
                  startOnboardingIfNeeded,
                } =
                  await import(
                    "../onboarding/setup.js"
                  );

                const loggerMod =
                  (
                    await import(
                      "../utils/logger.js"
                    )
                  ).default;

                attachLogGroupConn(
                  conn
                );

                loggerMod.setRemoteSink(
                  (
                    level,
                    msg,
                    detail
                  ) =>
                    systemLog(
                      level,
                      msg,
                      detail
                    )
                );

                const res =
                  await ensureLogGroup(
                    conn
                  );

                if (
                  res.needsManual
                ) {

                  console.warn(
                    "[onboarding] Set OWNER_NUMBER or run #setlog in a group you create."
                  );
                }

                if (res.jid) {

                  await startOnboardingIfNeeded(
                    conn
                  );
                }

              } catch (err) {

                console.error(
                  "Onboarding/log-group init failed:",
                  err?.message || err
                );
              }

            },
            2500
          );
        }

        /* =================================================
           CLOSE
           ================================================= */

        if (
          connection === "close"
        ) {

          const statusCode =
            lastDisconnect
              ?.error
              ?.output
              ?.statusCode;

          const shouldReconnect =
            statusCode !==
            DisconnectReason.loggedOut;

          stopReminderScheduler();

          cleanupSocket(conn);

          if (
            globalConnection ===
            conn
          ) {

            globalConnection =
              null;

            setConnection(
              null
            );
          }

          if (
            shouldReconnect
          ) {

            const delay =
              backoffDelay(
                reconnectAttempt
              );

            reconnectAttempt += 1;

            console.log(
              `❌ Connection closed (code ${
                statusCode ?? "?"
              }). Reconnecting in ${
                Math.round(
                  delay / 1000
                )
              }s...`
            );

            isConnecting =
              false;

            setTimeout(
              () => {

                connect().catch(
                  (err) => {

                    console.error(
                      "Reconnect failed:",
                      err?.message ||
                      err
                    );

                    isConnecting =
                      false;
                  }
                );

              },
              delay
            );

          } else {

            console.log(
              "🔓 Logged out. Restart the bot to login again."
            );

            isConnecting =
              false;
          }
        }
      }
    );

    /* =====================================================
       CREDS
       ===================================================== */

    conn.ev.on(
      "creds.update",
      saveCreds
    );

    /* =====================================================
       GROUP EVENTS
       ===================================================== */

    attachGroupParticipantEvents(
      conn
    );

    conn.ev.on(
      "groups.update",
      async (updates) => {

        for (
          const update of updates
        ) {

          if (update.id) {

            groupCache.delete(
              update.id
            );
          }
        }
      }
    );

    /* =====================================================
       INCOMING MESSAGES
       ===================================================== */

    conn.ev.on(
      "messages.upsert",
      async (m) => {

        try {

          if (
            m.type &&
            m.type !== "notify"
          )
            return;

          if (m.requestId)
            return;

          const msg =
            m.messages?.[0];

          if (
            !msg?.message
          )
            return;

          if (
            msg.key?.remoteJid ===
            "status@broadcast"
          )
            return;

          /* ===============================================
             CACHE RAW MESSAGE
             =============================================== */

          if (msg.key?.id) {

            msgCache.set(
              msg.key.id,
              msg.message
            );
          }

          /* ===============================================
             SERIALIZE
             =============================================== */

          const message =
            await serialize(
              msg,
              conn
            );

          if (!message)
            return;

          /* ===============================================
             GROUP GUARDS
             =============================================== */

          const blocked =
            await processGroupGuards({
              message,
              conn,
            });

          if (blocked)
            return;

          /* ===============================================
             COMMAND / CHAIN HANDLER
             =============================================== */

          await messageHandler({
            message,
            conn,
          });

        } catch (error) {

          console.error(
            "❌ Error processing message:",
            error?.message ||
            error
          );

          try {

            const {
              systemLog,
            } =
              await import(
                "../utils/logGroup.js"
              );

            await systemLog(
              "error",
              "messages.upsert failed",
              error
            );

          } catch {}
        }
      }
    );

    /*
     * =====================================================
     * OUTGOING MESSAGES
     * =====================================================
     *
     * Bot নিজে যে message পাঠায় তার ID এখানে পাওয়া যায়।
     * সেটাই Chain Reply memory-তে save করা হয়।
     */

    conn.ev.on(
      "messages.upsert",
      async (m) => {

        try {

          if (
            m.type &&
            m.type !== "notify"
          )
            return;

          for (
            const msg of
            m.messages || []
          ) {

            if (
              !msg?.key?.fromMe
            )
              continue;

            if (
              !msg.key.id
            )
              continue;

            const jid =
              msg.key.remoteJid;

            if (!jid)
              continue;

            let text = "";

            const content =
              msg.message;

            if (
              content?.conversation
            ) {

              text =
                content.conversation;

            } else if (
              content?.extendedTextMessage
            ) {

              text =
                content
                  .extendedTextMessage
                  ?.text ||
                "";

            } else if (
              content?.imageMessage
            ) {

              text =
                content
                  .imageMessage
                  ?.caption ||
                "";

            } else if (
              content?.videoMessage
            ) {

              text =
                content
                  .videoMessage
                  ?.caption ||
                "";
            }

            /*
             * Save bot message ID.
             */
            saveChainReply(
              msg.key.id,
              jid,
              text
            );
          }

        } catch (error) {

          console.error(
            "Chain reply tracking error:",
            error?.message ||
            error
          );
        }
      }
    );

    isConnecting =
      false;

    return conn;

  } catch (error) {

    isConnecting =
      false;

    cleanupSocket(
      conn
    );

    throw error;
  }
}

/* =========================================================
   GET CONNECTION
   ========================================================= */

export function getConnection() {
  return globalConnection;
}

/* =========================================================
   EXPORT
   ========================================================= */

export default connect;
