/**
 * Message Handler
 * ACL, flags, policy, audit, metrics
 * + Chain Reply detection
 */

import { findCommand } from "../plugins.js";
import { validateCommand } from "../utils/validation.js";
import { checkCommandAccess, isPrivileged } from "../utils/access.js";
import { sendError, ackCommand } from "../utils/message.js";
import { validateGroupPermissions } from "../utils/group.js";
import { groupCache } from "../utils/cache.js";
import { getGroupSettings } from "../utils/groupSettings.js";
import { BOT_INFO } from "../config/constants.js";
import { t } from "../utils/i18n.js";
import logger from "../utils/logger.js";
import { systemLog, isLogGroupAsync } from "../utils/logGroup.js";
import { checkCommandFlag } from "../enterprise/flags.js";
import { evaluatePolicy } from "../enterprise/policy.js";
import { writeAudit } from "../enterprise/audit.js";
import { recordCommand, recordError } from "../enterprise/metrics.js";

/* =========================================================
   CHAIN REPLY MEMORY
   ========================================================= */

const chainReplies = new Map();

const CHAIN_TIMEOUT = 30 * 60 * 1000;

/**
 * Save bot's sent message ID.
 */
export function saveChainReply(messageId, chatId, text = "") {
  if (!messageId) return;

  chainReplies.set(String(messageId), {
    chatId,
    text: String(text || ""),
    createdAt: Date.now(),
  });

  setTimeout(() => {
    chainReplies.delete(String(messageId));
  }, CHAIN_TIMEOUT);
}

/**
 * Check if this message is replying to our bot message.
 */
export function getChainReply(message) {
  const quotedId =
    message?.quoted?.id ||
    message?.quoted?.raw?.key?.id ||
    null;

  if (!quotedId) return null;

  const data = chainReplies.get(String(quotedId));

  if (!data) return null;

  if (Date.now() - data.createdAt > CHAIN_TIMEOUT) {
    chainReplies.delete(String(quotedId));
    return null;
  }

  return data;
}

/**
 * Get quoted text.
 */
export function getQuotedText(message) {
  return (
    message?.quoted?.text ||
    message?.quoted?.caption ||
    ""
  );
}

/* =========================================================
   AUDIT
   ========================================================= */

const AUDIT_ACTIONS = new Set([
  "kick",
  "warn",
  "mute",
  "unmute",
  "promote",
  "demote",
  "mode",
  "sudo",
  "broadcast",
  "disable",
  "enable",
  "flag",
  "policy",
  "role",
  "backup",
  "setlog",
  "createlog",
]);

/* =========================================================
   MAIN HANDLER
   ========================================================= */

export async function messageHandler(params) {
  const { message, conn } = params;

  try {
    if (!message) return;
    if (message.isBotMessage) return;
    if (!message.body) return;

    /*
     * Detect reply to bot.
     */
    const chain = getChainReply(message);

    /*
     * Normal message without command.
     *
     * Chain information is attached to the message so that
     * a future conversation/AI plugin can use it.
     */
    if (!message.body.startsWith(BOT_INFO.PREFIX)) {

      if (chain) {
        message.isChainReply = true;
        message.chain = {
          messageId:
            message?.quoted?.id ||
            message?.quoted?.raw?.key?.id ||
            null,

          previousReply: chain.text,

          quotedText: getQuotedText(message),

          chatId: chain.chatId,
        };

        logger.info?.(
          `Chain reply detected from ${message.sender || "unknown"}`
        );

        /*
         * IMPORTANT:
         *
         * এখানে কোনো command নেই।
         * তাই যদি তোমার bot-এ conversational/AI handler থাকে,
         * সেটা এখানে call করতে পারবে।
         *
         * Example:
         *
         * await conversationHandler(message, conn);
         *
         * Function না থাকায় আমরা fake response দিচ্ছি না।
         */
      }

      return;
    }

    /* =======================================================
       COMMAND
       ======================================================= */

    const command = findCommand(message.body);
    if (!command) return;

    const name =
      (command.patternName || "").toLowerCase();

    const privileged =
      await isPrivileged(message, conn);

    /* =======================================================
       ACCESS
       ======================================================= */

    const access =
      await checkCommandAccess(
        message,
        command,
        conn
      );

    if (!access.allowed) {
      if (access.silent) return;

      await sendError(
        conn,
        message.from,
        access.reason || "OWNER_ONLY"
      );

      return;
    }

    /* =======================================================
       FEATURE FLAGS
       ======================================================= */

    const flagCheck =
      await checkCommandFlag(name);

    if (!flagCheck.ok) {

      if (
        flagCheck.flag === "maintenance" &&
        privileged
      ) {
        // privileged bypass
      }

      else if (
        flagCheck.flag === "maintenance"
      ) {
        await sendError(
          conn,
          message.from,
          "🛠 Bot is in *maintenance mode*. Try again later."
        );

        return;
      }

      else {
        await sendError(
          conn,
          message.from,
          `⚠️ Feature *${flagCheck.flag}* is disabled.`
        );

        return;
      }
    }

    /* =======================================================
       POLICY
       ======================================================= */

    const policy =
      await evaluatePolicy(
        message,
        command,
        { privileged }
      );

    if (!policy.ok) {

      const msgs = {
        QUIET_HOURS:
          "🌙 Quiet hours — try again later.",

        RATE_LIMIT:
          "⏳ Slow down — rate limit hit.",

        MEDIA_DISABLED:
          "⚠️ Media commands are disabled by policy.",

        BROADCAST_BLOCKED:
          "⚠️ Broadcast is blocked by policy.",
      };

      await sendError(
        conn,
        message.from,
        msgs[policy.reason] ||
        policy.reason
      );

      return;
    }

    /* =======================================================
       GROUP SETTINGS
       ======================================================= */

    if (
      message.isGroup &&
      command.patternName
    ) {

      const settings =
        await getGroupSettings(
          message.from
        );

      const disabled =
        settings.disabledPlugins || [];

      if (disabled.includes(name)) {

        if (!privileged) {

          await sendError(
            conn,
            message.from,
            await t("PLUGIN_DISABLED")
          );

          return;
        }
      }
    }

    /* =======================================================
       LOG
       ======================================================= */

    logger.command(
      name || "unknown",
      message.sender,
      message.isGroup
        ? message.from
        : null
    );

    /* =======================================================
       VALIDATION
       ======================================================= */

    const validation =
      await validateCommand(
        message,
        command,
        conn
      );

    if (!validation.valid) {

      await sendError(
        conn,
        message.from,
        validation.error
      );

      return;
    }

    /* =======================================================
       GROUP PERMISSIONS
       ======================================================= */

    if (
      message.isGroup &&
      (
        command.adminOnly ||
        command.botAdminRequired
      )
    ) {

      let groupMetadata =
        groupCache.get(
          message.from
        );

      if (!groupMetadata) {

        groupMetadata =
          await conn.groupMetadata(
            message.from
          );

        groupCache.set(
          message.from,
          groupMetadata
        );
      }

      const groupValidation =
        validateGroupPermissions(
          message,
          groupMetadata,
          {
            adminOnly:
              command.adminOnly,

            botAdminRequired:
              command.botAdminRequired,
          },
          conn
        );

      if (!groupValidation.valid) {

        await sendError(
          conn,
          message.from,
          groupValidation.error
        );

        return;
      }
    }

    /* =======================================================
       ACK
       ======================================================= */

    await ackCommand(
      conn,
      message
    );

    recordCommand(
      name || "unknown"
    );

    /* =======================================================
       RUN COMMAND
       ======================================================= */

    await command.function(
      message,
      conn
    );

    /* =======================================================
       AUDIT
       ======================================================= */

    if (AUDIT_ACTIONS.has(name)) {

      writeAudit({
        action: `cmd.${name}`,

        actor:
          message.sender,

        chat:
          message.from,

        meta: {
          body:
            String(
              message.body || ""
            ).slice(0, 120),
        },

      }).catch(() => {});
    }

  } catch (error) {

    recordError();

    const where =
      `${commandNameSafe(message)} @ ${
        message?.from || "?"
      }`;

    await systemLog(
      "error",
      `Handler crash: ${where}`,
      error
    );

    const inLog =
      await isLogGroupAsync(
        message?.from
      );

    try {

      if (inLog) {

        await sendError(
          conn,
          message.from,
          `Handler error: ${
            error?.message ||
            "unknown"
          } (see log above)`
        );

      } else {

        await sendError(
          conn,
          message.from,
          await t("FAILED")
        );
      }

    } catch (sendErr) {

      recordError();

      await systemLog(
        "error",
        "Failed to send user-safe error",
        sendErr
      );
    }
  }
}

/* =========================================================
   SAFE COMMAND NAME
   ========================================================= */

function commandNameSafe(message) {

  try {

    const body =
      message?.body || "";

    return (
      body.split(/\s+/)[0] ||
      "unknown"
    );

  } catch {

    return "unknown";
  }
}
