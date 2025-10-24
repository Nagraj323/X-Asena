import { command } from "../plugins.js";
import { isPnUser, isLidUser, isGroup } from "../functions.js";

command(
    {
        pattern: "info",
        fromMe: false,
        desc: "Shows user and message information (Baileys 7.x.x compatible)",
        type: "misc",
    },
    async (message, conn) => {
        let info = "📱 *Message Information*\n\n";
        info += `*Chat Type:* ${message.isGroup ? "Group" : "Direct Message"}\n`;
        info += `*Chat ID:* ${message.from}\n`;
        if (message.fromAlt) {
            info += `*Chat ID (Alt):* ${message.fromAlt}\n`;
        }
        info += `\n*Sender:* ${message.pushName || "Unknown"}\n`;
        info += `*Sender ID:* ${message.participant}\n`;
        if (message.participantAlt) {
            info += `*Sender ID (Alt):* ${message.participantAlt}\n`;
        }
        info += `*Preferred ID:* ${message.sender}\n`;
        const senderType = isLidUser(message.participant) 
            ? "LID (Local Identifier)" 
            : isPnUser(message.participant) 
            ? "PN (Phone Number)" 
            : "Unknown";
        info += `*ID Type:* ${senderType}\n`;
        info += `\n*Message Type:* ${message.type}\n`;
        info += `*Message ID:* ${message.id}\n`;
        if (message.quoted) {
            info += `*Quoted:* Yes\n`;
        }
        if (message.isGroup) {
            try {
                const groupMetadata = await conn.groupMetadata(message.from);
                info += `\n*Group Name:* ${groupMetadata.subject}\n`;
                info += `*Participants:* ${groupMetadata.participants.length}\n`;
                if (groupMetadata.owner) {
                    info += `*Owner ID:* ${groupMetadata.owner}\n`;
                }
                if (groupMetadata.ownerPn) {
                    info += `*Owner PN:* ${groupMetadata.ownerPn}\n`;
                }
            } catch (error) {
                info += `\n_Could not fetch group metadata_\n`;
            }
        }
        await conn.sendMessage(
            message.from,
            { text: info },
            {
                quoted: {
                    key: message.key,
                    message: message.message
                }
            }
        );
    }
);
