import { command } from "../plugins.js";

command(
    {
        pattern: "ping",
        fromMe: false,
        desc: "Replies with pong",
        type: "misc",
    },
    async (message, conn) => {
        // Calculate response time
        const start = Date.now();
        await conn.sendMessage(
            message.from, 
            { text: "🏓 Pong!" }, 
            { 
                quoted: {
                    key: message.key,
                    message: message.message
                }
            }
        );
        const end = Date.now();
        await conn.sendMessage(
            message.from, 
            { text: `Response time: ${end - start}ms` }, 
            { 
                quoted: {
                    key: message.key,
                    message: message.message
                }
            }
        );
    }
);
