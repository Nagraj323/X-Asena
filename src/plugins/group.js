import { command } from "../index.js";

command(
  {
    pattern: "mention",
    fromMe: true,
    desc: "Mention all users in group",
    type: "group",
  },
  async (message, conn) => {
    try {
      // Check if it's a group
      if (!message.isGroup) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ This command can only be used in groups!"
        });
      }

      // Extract match text from command or quoted message
      // Pattern captures everything after the command
      const match = message.body.match(/mention\s+(.*)/is);
      let mentionText = match ? match[1].trim() : null;

      // If no text provided, check for quoted message
      if (!mentionText && message.quoted) {
        mentionText = message.quoted.text || message.quoted.caption || null;
      }

      // If still no text, send a __Notified Everyone__ message
      if (!mentionText) {
        mentionText = "🔔 *_Notified Everyone_*";
      }

      // Get group metadata (updated for Baileys 7.x with LID/PN support)
      const groupMetadata = await conn.groupMetadata(message.from);
      const participants = groupMetadata.participants;

      // In Baileys 7.x.x, participants have 'id' field which can be LID or PN
      // Extract all participant IDs for mentions
      const participantIds = participants.map((p) => p.id);

      // Send message with mentions
      // In v7.x, mentions array should contain the IDs (LID or PN)
      await conn.sendMessage(
        message.from,
        {
          text: `${mentionText}`,
          mentions: participantIds
        },
      );

    } catch (error) {
      console.error("Error in mention command:", error);
      await conn.sendMessage(message.from, {
        text: "❌ An error occurred while trying to mention everyone."
      });
    }
  }
);
