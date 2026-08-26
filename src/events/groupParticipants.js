/**
 * Group participant welcome / goodbye + bot-added hello + antiout
 */

import { groupCache } from "../utils/cache.js";
import logger from "../utils/logger.js";
import { isLogGroupAsync } from "../utils/logGroup.js";
import { BOT_INFO } from "../config/constants.js";
import { normalizeNumber } from "../utils/access.js";

function isBotParticipant(conn, participantJid) {
  if (!conn?.user?.id || !participantJid) return false;

  const bot = normalizeNumber(
    conn.user.id.replace(/:\d+@/, "@")
  );

  const p = normalizeNumber(participantJid);

  const botLid = conn.user.lid
    ? normalizeNumber(conn.user.lid)
    : null;

  return p === bot || (botLid && p === botLid);
}

/**
 * Wire group-participants.update on a socket
 */
export function attachGroupParticipantEvents(conn) {
  conn.ev.on("group-participants.update", async (update) => {
    try {
      const {
        id: groupJid,
        participants,
        action,
      } = update;

      if (!groupJid || !participants?.length) return;

      groupCache.delete(groupJid);

      let meta;

      try {
        meta = await conn.groupMetadata(groupJid);
        groupCache.set(groupJid, meta);
      } catch {
        meta = {
          subject: "Group",
          participants: [],
        };
      }

      const groupName = meta.subject || "Group";
      const count = meta.participants?.length || 0;

      const logGroup = await isLogGroupAsync(groupJid);

      /*
       * ============================
       * ANTI OUT
       * ============================
       *
       * কেউ গ্রুপ থেকে বের হলে bot তাকে
       * আবার automatically add করার চেষ্টা করবে।
       *
       * শুধু normal group-এ কাজ করবে।
       */

      if (action === "remove" && !logGroup) {
        for (const p of participants) {
          const user = typeof p === "string"
            ? p
            : p?.id || p;

          if (!user) continue;

          // Bot নিজে leave করলে আবার add করার চেষ্টা করবে না
          if (isBotParticipant(conn, user)) continue;

          try {
            await conn.groupParticipantsUpdate(
              groupJid,
              [user],
              "add"
            );

            console.log(
              `🔄 AntiOut: ${user} was added back to ${groupName}`
            );
          } catch (err) {
            console.warn(
              `⚠️ AntiOut failed for ${user}:`,
              err?.message || err
            );
          }
        }

        // Antiout করার পর আর goodbye message পাঠাবো না
        return;
      }

      /*
       * ============================
       * BOT ADDED
       * ============================
       */

      for (const p of participants) {
        const mention =
          typeof p === "string"
            ? p
            : p?.id || p;

        if (!mention) continue;

        // Bot was added to group
        if (
          action === "add" &&
          isBotParticipant(conn, mention) &&
          !logGroup
        ) {
          await conn.sendMessage(groupJid, {
            text:
              `👋 *${BOT_INFO.NAME}* is here.\n\n` +
              `Use \`${BOT_INFO.PREFIX}menu\` to see commands.`,
          });

          continue;
        }

        if (logGroup) continue;

        const tag =
          `@${String(mention).split("@")[0]}`;

        /*
         * ============================
         * WELCOME
         * ============================
         *
         * পুরোনো group settings না থাকায়
         * এখানে default welcome রাখা হয়নি।
         */

        if (action === "add") {
          await conn.sendMessage(groupJid, {
            text:
              `👋 Welcome ${tag} to *${groupName}*!\n` +
              `👥 Members: ${count}`,
            mentions: [mention],
          });
        }
      }
    } catch (err) {
      logger.warn(
        "group-participants.update:",
        err?.message || err
      );
    }
  });
}
