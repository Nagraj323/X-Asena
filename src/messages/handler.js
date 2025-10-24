import { commands } from "../plugins.js";

export async function messageHandler(params) {
    const { message, conn } = params;
    if (message.isBotMessage) return;
    const command = commands.find(cmd => cmd.pattern.test(message.body));
   if (command) {
        await command.function(message, conn);
    }
}