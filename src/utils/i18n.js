/**
 * Lightweight multi-language replies
 */

import { kvGet, kvSet, seedBotKvFromEnv } from "../database/botKv.js";

const STRINGS = {
  en: {
    GROUP_ONLY: "⚠️ This command can only be used in groups!",
    OWNER_ONLY: "⚠️ This command is only for the bot owner!",
    ADMIN_ONLY: "⚠️ This command is only for group admins!",
    BOT_ADMIN: "⚠️ Bot needs to be admin to perform this action!",
    FAILED: "❌ An error occurred while processing your request.",
    DONE: "✅ Done!",
    PLUGIN_DISABLED: "⚠️ This command is disabled in this group.",
    MUTED: "🔇 You are muted in this group.",
    WARNED: "⚠️ @user warned ({count}/{limit})",
    KICKED_WARNS: "🚫 @user removed after reaching warn limit.",
    ANTILINK: "🔗 Links are not allowed here.",
    ANTISPAM: "🛑 Slow down — spam detected.",
    WELCOME_ON: "✅ Welcome messages enabled",
    WELCOME_OFF: "✅ Welcome messages disabled",
    GOODBYE_ON: "✅ Goodbye messages enabled",
    GOODBYE_OFF: "✅ Goodbye messages disabled",
    LANG_SET: "✅ Language set to *{lang}*",
    LANG_LIST: "Available: {list}\nCurrent: *{lang}*",
    REMINDER_SET: "✅ Reminder set for {when}",
    NOTE_SAVED: "✅ Note saved as *{id}*",
    NOTE_DELETED: "✅ Note *{id}* deleted",
    NOTE_NOT_FOUND: "⚠️ Note not found",
    BROADCAST_DONE: "✅ Broadcast sent to {ok}/{total} chats",
    PAIRING_HINT: "Enter the pairing code on your phone",
  },
  id: {
    GROUP_ONLY: "⚠️ Perintah ini hanya untuk grup!",
    OWNER_ONLY: "⚠️ Hanya pemilik bot!",
    ADMIN_ONLY: "⚠️ Hanya admin grup!",
    BOT_ADMIN: "⚠️ Bot harus jadi admin!",
    FAILED: "❌ Terjadi kesalahan.",
    DONE: "✅ Selesai!",
    PLUGIN_DISABLED: "⚠️ Perintah ini dinonaktifkan di grup ini.",
    MUTED: "🔇 Kamu di-mute di grup ini.",
    WARNED: "⚠️ @user diperingatkan ({count}/{limit})",
    KICKED_WARNS: "🚫 @user dikeluarkan karena batas peringatan.",
    ANTILINK: "🔗 Link tidak diizinkan di sini.",
    ANTISPAM: "🛑 Pelan-pelan — spam terdeteksi.",
    WELCOME_ON: "✅ Pesan selamat datang aktif",
    WELCOME_OFF: "✅ Pesan selamat datang nonaktif",
    GOODBYE_ON: "✅ Pesan perpisahan aktif",
    GOODBYE_OFF: "✅ Pesan perpisahan nonaktif",
    LANG_SET: "✅ Bahasa diubah ke *{lang}*",
    LANG_LIST: "Tersedia: {list}\nSekarang: *{lang}*",
    REMINDER_SET: "✅ Pengingat disetel untuk {when}",
    NOTE_SAVED: "✅ Catatan *{id}* disimpan",
    NOTE_DELETED: "✅ Catatan *{id}* dihapus",
    NOTE_NOT_FOUND: "⚠️ Catatan tidak ditemukan",
    BROADCAST_DONE: "✅ Broadcast terkirim ke {ok}/{total} chat",
    PAIRING_HINT: "Masukkan kode pairing di ponselmu",
  },
  hi: {
    GROUP_ONLY: "⚠️ यह कमांड सिर्फ ग्रुप में चलता है!",
    OWNER_ONLY: "⚠️ सिर्फ बॉट ओनर के लिए!",
    ADMIN_ONLY: "⚠️ सिर्फ ग्रुप एडमिन!",
    BOT_ADMIN: "⚠️ बॉट को एडमिन होना चाहिए!",
    FAILED: "❌ कुछ गलत हो गया।",
    DONE: "✅ हो गया!",
    PLUGIN_DISABLED: "⚠️ इस ग्रुप में कमांड बंद है।",
    MUTED: "🔇 आपको इस ग्रुप में म्यूट किया गया है।",
    WARNED: "⚠️ @user वार्न ({count}/{limit})",
    KICKED_WARNS: "🚫 वार्न लिमिट पर @user को निकाला गया।",
    ANTILINK: "🔗 यहाँ लिंक की अनुमति नहीं है।",
    ANTISPAM: "🛑 धीरे — स्पैम मिला।",
    WELCOME_ON: "✅ वेलकम मैसेज चालू",
    WELCOME_OFF: "✅ वेलकम मैसेज बंद",
    GOODBYE_ON: "✅ गुडबाय मैसेज चालू",
    GOODBYE_OFF: "✅ गुडबाय मैसेज बंद",
    LANG_SET: "✅ भाषा *{lang}* सेट हुई",
    LANG_LIST: "उपलब्ध: {list}\nअभी: *{lang}*",
    REMINDER_SET: "✅ रिमाइंडर {when} के लिए सेट",
    NOTE_SAVED: "✅ नोट *{id}* सेव हुआ",
    NOTE_DELETED: "✅ नोट *{id}* हटाया",
    NOTE_NOT_FOUND: "⚠️ नोट नहीं मिला",
    BROADCAST_DONE: "✅ ब्रॉडकास्ट {ok}/{total} चैट्स पर भेजा",
    PAIRING_HINT: "फोन पर पेयरिंग कोड डालें",
  },
};

export const AVAILABLE_LANGS = Object.keys(STRINGS);

let cachedLang = null;

async function ensureLang() {
  if (cachedLang) return cachedLang;
  try {
    await seedBotKvFromEnv();
    const stored = await kvGet("lang");
    if (stored && STRINGS[stored]) {
      cachedLang = stored;
      return cachedLang;
    }
  } catch {
    /* ignore */
  }
  const env = (process.env.BOT_LANG || "en").toLowerCase();
  cachedLang = STRINGS[env] ? env : "en";
  return cachedLang;
}

export async function getLang() {
  return ensureLang();
}

export async function setLang(lang) {
  const next = String(lang || "").toLowerCase();
  if (!STRINGS[next]) throw new Error("Unsupported language");
  await kvSet("lang", next);
  cachedLang = next;
  return next;
}

/**
 * Translate key with optional {placeholders}
 */
export async function t(key, vars = {}) {
  const lang = await ensureLang();
  let text =
    STRINGS[lang]?.[key] || STRINGS.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function tSync(key, vars = {}, lang = "en") {
  let text = STRINGS[lang]?.[key] || STRINGS.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}
