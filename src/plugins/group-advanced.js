/**
 * Advanced Group Management Plugin for Baileys 7.x.x
 * Handles LID/PN identifiers properly
 */

import { command } from "../index.js";
import { isPnUser, isLidUser } from "../functions.js";

// ==================== TAG ALL ====================
command(
  {
    pattern: "tagall",
    fromMe: true,
    desc: "Tag all group members with their names",
    type: "group",
  },
  async (message, conn) => {
    try {
      if (!message.isGroup) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ This command can only be used in groups!"
        });
      }

      // Get group metadata
      const groupMetadata = await conn.groupMetadata(message.from);
      const participants = groupMetadata.participants;

      // Build message with all participants
      let tagMessage = `*${groupMetadata.subject}*\n\n`;
      tagMessage += `👥 *Total Members:* ${participants.length}\n\n`;
      
      // In Baileys 7.x, each participant has:
      // - id: preferred identifier (LID or PN)
      // - phoneNumber: phone number (if id is LID)
      // - lid: LID (if id is PN)
      const mentionIds = [];
      
      participants.forEach((participant, index) => {
        const id = participant.id;
        mentionIds.push(id);
        
        // Show number based on type
        let displayNumber = "";
        if (isPnUser(id)) {
          // It's a phone number format
          displayNumber = id.split("@")[0];
        } else if (isLidUser(id)) {
          // It's a LID, use phoneNumber field if available
          displayNumber = participant.phoneNumber 
            ? participant.phoneNumber.split("@")[0] 
            : "LID User";
        }
        
        tagMessage += `${index + 1}. @${displayNumber}\n`;
      });

      // Send with mentions
      await conn.sendMessage(
        message.from,
        {
          text: tagMessage,
          mentions: mentionIds
        },
        {
          quoted: {
            key: message.key,
            message: message.message
          }
        }
      );

    } catch (error) {
      console.error("Error in tagall command:", error);
      await conn.sendMessage(message.from, {
        text: "❌ Failed to tag all members."
      });
    }
  }
);

// ==================== GROUP INFO ====================
command(
  {
    pattern: "groupinfo",
    fromMe: false,
    desc: "Get detailed group information",
    type: "group",
  },
  async (message, conn) => {
    try {
      if (!message.isGroup) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ This command can only be used in groups!"
        });
      }

      const groupMetadata = await conn.groupMetadata(message.from);
      
      // Build group info message
      let info = `*📋 GROUP INFORMATION*\n\n`;
      info += `*Name:* ${groupMetadata.subject}\n`;
      info += `*Group ID:* ${groupMetadata.id}\n`;
      info += `*Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n`;
      
      // Owner info (with LID/PN support)
      if (groupMetadata.owner) {
        info += `\n*👑 Owner:*\n`;
        info += `• ID: ${groupMetadata.owner}\n`;
        
        // In v7.x, owner is LID and ownerPn is the phone number
        if (groupMetadata.ownerPn) {
          info += `• Phone: ${groupMetadata.ownerPn.split("@")[0]}\n`;
        }
        
        info += `• Type: ${isLidUser(groupMetadata.owner) ? "LID" : "PN"}\n`;
      }
      
      // Description owner (if different from group owner)
      if (groupMetadata.descOwner && groupMetadata.descOwner !== groupMetadata.owner) {
        info += `\n*📝 Description Owner:*\n`;
        info += `• ID: ${groupMetadata.descOwner}\n`;
        
        if (groupMetadata.descOwnerPn) {
          info += `• Phone: ${groupMetadata.descOwnerPn.split("@")[0]}\n`;
        }
      }
      
      // Participants statistics
      const participants = groupMetadata.participants;
      const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
      const superAdmins = participants.filter(p => p.admin === "superadmin");
      const regularMembers = participants.filter(p => !p.admin);
      
      // Count LID vs PN users
      const lidUsers = participants.filter(p => isLidUser(p.id));
      const pnUsers = participants.filter(p => isPnUser(p.id));
      
      info += `\n*👥 Members:*\n`;
      info += `• Total: ${participants.length}\n`;
      info += `• Super Admins: ${superAdmins.length}\n`;
      info += `• Admins: ${admins.length - superAdmins.length}\n`;
      info += `• Regular: ${regularMembers.length}\n`;
      
      info += `\n*🆔 Identifier Types:*\n`;
      info += `• LID Users: ${lidUsers.length}\n`;
      info += `• PN Users: ${pnUsers.length}\n`;
      
      // Group settings
      info += `\n*⚙️ Settings:*\n`;
      info += `• Announce: ${groupMetadata.announce ? "Only Admins" : "All Members"}\n`;
      info += `• Restrict: ${groupMetadata.restrict ? "Only Admins" : "All Members"}\n`;
      
      // Description
      if (groupMetadata.desc) {
        info += `\n*📄 Description:*\n${groupMetadata.desc}\n`;
      }

      await conn.sendMessage(message.from, { text: info });

    } catch (error) {
      console.error("Error in groupinfo command:", error);
      await conn.sendMessage(message.from, {
        text: "❌ Failed to get group information."
      });
    }
  }
);

// ==================== PROMOTE ====================
command(
  {
    pattern: "promote",
    fromMe: true,
    desc: "Promote a member to admin (mention or reply)",
    type: "group",
  },
  async (message, conn) => {
    try {
      if (!message.isGroup) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ This command can only be used in groups!"
        });
      }

      // Get user to promote (from quoted message or mentions)
      let targetUser = null;
      
      if (message.quoted) {
        // If replying to a message, promote that user
        const quotedKey = message.message.contextInfo?.quotedMessage;
        const quotedParticipant = message.message.contextInfo?.participant;
        targetUser = quotedParticipant;
      } else if (message.message.contextInfo?.mentionedJid?.length > 0) {
        // If mentioning someone, promote them
        targetUser = message.message.contextInfo.mentionedJid[0];
      }

      if (!targetUser) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ Please mention a user or reply to their message.\n\n*Usage:* `promote @user` or reply with `promote`"
        });
      }

      // Promote the user (works with both LID and PN)
      await conn.groupParticipantsUpdate(
        message.from,
        [targetUser],
        "promote"
      );

      const displayId = targetUser.split("@")[0];
      await conn.sendMessage(message.from, {
        text: `✅ Successfully promoted @${displayId} to admin!`,
        mentions: [targetUser]
      });

    } catch (error) {
      console.error("Error in promote command:", error);
      await conn.sendMessage(message.from, {
        text: "❌ Failed to promote user. Make sure you have admin permissions."
      });
    }
  }
);

// ==================== DEMOTE ====================
command(
  {
    pattern: "demote",
    fromMe: true,
    desc: "Demote an admin to member (mention or reply)",
    type: "group",
  },
  async (message, conn) => {
    try {
      if (!message.isGroup) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ This command can only be used in groups!"
        });
      }

      // Get user to demote
      let targetUser = null;
      
      if (message.quoted) {
        const quotedParticipant = message.message.contextInfo?.participant;
        targetUser = quotedParticipant;
      } else if (message.message.contextInfo?.mentionedJid?.length > 0) {
        targetUser = message.message.contextInfo.mentionedJid[0];
      }

      if (!targetUser) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ Please mention a user or reply to their message.\n\n*Usage:* `demote @user` or reply with `demote`"
        });
      }

      // Demote the user (works with both LID and PN)
      await conn.groupParticipantsUpdate(
        message.from,
        [targetUser],
        "demote"
      );

      const displayId = targetUser.split("@")[0];
      await conn.sendMessage(message.from, {
        text: `✅ Successfully demoted @${displayId} to member!`,
        mentions: [targetUser]
      });

    } catch (error) {
      console.error("Error in demote command:", error);
      await conn.sendMessage(message.from, {
        text: "❌ Failed to demote user. Make sure you have admin permissions."
      });
    }
  }
);

// ==================== ADMINS ====================
command(
  {
    pattern: "admins",
    fromMe: false,
    desc: "List all group admins",
    type: "group",
  },
  async (message, conn) => {
    try {
      if (!message.isGroup) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ This command can only be used in groups!"
        });
      }

      const groupMetadata = await conn.groupMetadata(message.from);
      const participants = groupMetadata.participants;
      
      // Filter admins and super admins
      const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
      
      if (admins.length === 0) {
        return await conn.sendMessage(message.from, {
          text: "⚠️ No admins found in this group."
        });
      }

      let adminList = `*👑 GROUP ADMINS*\n\n`;
      adminList += `*Group:* ${groupMetadata.subject}\n`;
      adminList += `*Total Admins:* ${admins.length}\n\n`;
      
      const mentionIds = [];
      
      admins.forEach((admin, index) => {
        const id = admin.id;
        mentionIds.push(id);
        
        const role = admin.admin === "superadmin" ? "👑 Super Admin" : "🛡️ Admin";
        const displayId = id.split("@")[0];
        
        adminList += `${index + 1}. @${displayId} - ${role}\n`;
      });

      await conn.sendMessage(
        message.from,
        {
          text: adminList,
          mentions: mentionIds
        }
      );

    } catch (error) {
      console.error("Error in admins command:", error);
      await conn.sendMessage(message.from, {
        text: "❌ Failed to get admin list."
      });
    }
  }
);
