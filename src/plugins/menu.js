/**
 * Menu / Help Command
 */

import { command, getMenuCommands } from "../plugins.js";
import { reply } from "../utils/message.js";
import { BOT_INFO } from "../config/constants.js";
import { getMode } from "../utils/access.js";

async function buildMenuText() {
  const cmds = getMenuCommands();
  const byType = new Map();

  for (const cmd of cmds) {
    const type = cmd.type || "misc";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(cmd);
  }

  const typeOrder = ["misc", "info", "group", "admin", "owner", "media"];
  const types = [
    ...typeOrder.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !typeOrder.includes(t)).sort(),
  ];

  let lang = "en";
  try {
    const { getLang } = await import("../utils/i18n.js");
    lang = await getLang();
  } catch {
    /* ignore */
  }

  let text = `*${BOT_INFO.NAME}* v${BOT_INFO.VERSION}\n`;
  text += `Prefix: \`${BOT_INFO.PREFIX}\` · Lang: \`${lang}\`\n\n`;

  for (const type of types) {
    const list = byType.get(type);
    text += `*${type.toUpperCase()}*\n`;
    for (const cmd of list.sort((a, b) =>
      a.patternName.localeCompare(b.patternName)
    )) {
      const usage = `${BOT_INFO.PREFIX}${cmd.patternName}`;
      text += `• ${usage}`;
      if (cmd.desc) text += ` — ${cmd.desc}`;
      text += `\n`;
    }
    text += `\n`;
  }

  let mode = "public";
  try {
    mode = await getMode();
  } catch {
    /* BotKV may not be ready */
  }

  text += `_Mode: ${mode}_\n`;
  text += `_Reply with a command to use it._`;
  return text;
}

async function sendMenu(message, conn) {
  await reply(conn, message, await buildMenuText());
}

command(
  {
    pattern: "menu",
    fromMe: false,
    desc: "Show all commands",
    type: "misc",
  },
  sendMenu
);

command(
  {
    pattern: "help",
    fromMe: false,
    desc: "Show menu or help for one command",
    type: "misc",
    dontAddCommandList: true,
  },
  async (message, conn) => {
    const args = (message.body || "")
      .replace(new RegExp(`^\\${BOT_INFO.PREFIX}\\s*help\\s*`, "i"), "")
      .trim()
      .toLowerCase();

    if (!args) {
      await sendMenu(message, conn);
      return;
    }

    const cmds = getMenuCommands();
    const hit =
      cmds.find((c) => c.patternName === args) ||
      cmds.find((c) => c.patternName.startsWith(args));

    if (!hit) {
      const suggestions = cmds
        .filter((c) => c.patternName.includes(args))
        .slice(0, 5)
        .map((c) => `\`${c.patternName}\``);
      await reply(
        conn,
        message,
        suggestions.length
          ? `Unknown. Did you mean: ${suggestions.join(", ")}?`
          : `Unknown command. Try \`${BOT_INFO.PREFIX}menu\`.`
      );
      return;
    }

    await reply(
      conn,
      message,
      `*${BOT_INFO.PREFIX}${hit.patternName}*\n` +
        `${hit.desc || "_No description_"}\n` +
        `Type: ${hit.type}` +
        (hit.groupOnly ? " · group" : "") +
        (hit.adminOnly ? " · admin" : "") +
        (hit.fromMe ? " · owner" : "")
    );
  }
);

