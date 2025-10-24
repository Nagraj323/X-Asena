const MIME_TYPE_MAP = {
    imageMessage: "image",
    videoMessage: "video",
    stickerMessage: "sticker",
    documentMessage: "document",
    audioMessage: "audio",
    documentWithCaptionMessage: "document",
    viewOnceMessageV2: "image",
    viewOnceMessageV2Extension: "image",
    extendedTextMessage: "text",
};

/**
 * Gets the message type and MIME type from a message object.
 * @param {object} message - The message object to analyze.
 * @returns {{key: string, mime: string}} The message type key and MIME type.
 */
function getMessageMimeType(message) {
    if (!message) return { key: "unknown", mime: "unknown" };

    for (const key in message) {
        if (MIME_TYPE_MAP[key]) {
            return { key, mime: MIME_TYPE_MAP[key] };
        }
    }

    return { key: "unknown", mime: "unknown" };
}

/**
 * Extracts quoted message content from context info.
 * @param {object} contextInfo - The context info object.
 * @returns {object|null} The quoted message content or null.
 */
function extractQuotedMessage(contextInfo) {
    if (!contextInfo?.quotedMessage) return null;

    const { key: quotedKey } = getMessageMimeType(contextInfo.quotedMessage);
    const quotedNest = contextInfo.quotedMessage[quotedKey];

    if (!quotedNest?.message) return null;

    const { key: nestKey } = getMessageMimeType(quotedNest.message);
    return quotedNest.message[nestKey] || null;
}

/**
 * Determines sender information with LID/PN support.
 * @param {object} key - The message key object.
 * @param {boolean} isGroup - Whether the message is from a group.
 * @param {object} conn - The Baileys connection object.
 * @returns {object} Sender information object.
 */
function getSenderInfo(key, isGroup, conn) {
    const isBotMessage = key.fromMe && !key.participant;

    if (isGroup) {
        // Group messages
        const participant = key.participant || null;
        const participantAlt = key.participantAlt || null;

        // For bot messages, use bot's ID; otherwise use participant
        const sender = isBotMessage
            ? conn.user?.id
            : (participantAlt || participant);

        return { participant, participantAlt, sender, isBotMessage };
    } else {
        // Direct messages
        const participant = key.remoteJid;
        const participantAlt = key.remoteJidAlt || null;

        const sender = key.fromMe
            ? conn.user?.id
            : (participantAlt || participant);

        return { participant, participantAlt, sender, isBotMessage };
    }
}

/**
 * Serializes a Baileys message object to make it easier to work with.
 * Updated for Baileys 7.x.x with LID support.
 * 
 * LID (Lidded ID) vs PN (Phone Number):
 * - LID: Format like '218837307916530@lid' - privacy-focused identifier
 * - PN: Format like '918113921898@s.whatsapp.net' - traditional phone number
 * - remoteJidAlt: Alternate identifier for DMs (PN if main is LID)
 * - participantAlt: Alternate identifier for group participants
 * 
 * @param {object} message - The raw Baileys message object.
 * @param {object} conn - The Baileys connection object.
 * @returns {Promise<object|null>} The serialized message object.
 */
async function serialize(message, conn) {
    // Early validation
    if (!message?.key?.remoteJid || !message?.message) return null;

    const { key, message: msgContent, pushName } = message;

    // Get message type and MIME
    const { key: messageTypeKey, mime: messageMime } = getMessageMimeType(msgContent);
    if (messageMime === "unknown") return null;

    // Extract message content
    const messageContent = msgContent[messageTypeKey];
    const isGroup = key.remoteJid.endsWith("@g.us");

    // Chat identifiers with LID/PN support
    const from = key.remoteJid;
    const fromAlt = key.remoteJidAlt || null;

    // Extract sender information
    const { participant, participantAlt, sender, isBotMessage } = getSenderInfo(key, isGroup, conn);

    // Extract quoted message
    const quoted = extractQuotedMessage(messageContent?.contextInfo);

    // Extract message body text
    const body = messageContent?.text || messageContent?.caption || "";

    return {
        // Core identifiers
        key,
        id: key.id,
        pushName: pushName || "",
        // Chat info
        isGroup,
        from,
        fromAlt,
        // Message content
        type: messageMime,
        message: messageContent,
        body,
        quoted,
        // Sender info (with LID/PN support)
        participant,
        participantAlt,
        sender,
        // Bot detection
        isBotMessage,
    };
}

export { serialize };