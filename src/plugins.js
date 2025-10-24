import config from "../config.js";

const commands = [];

/**
 * Define a command and store it in the commands array.
 * @param {Object} commandInfo - Information about the command.
 * @param {Function} func - The function to execute when the command is triggered.
 * @returns {Object} - The command information.
 */
export const command = (commandInfo, func) => {
    commandInfo.function = func;
    if (commandInfo.pattern) {
        commandInfo.pattern =
            new RegExp(
                `(#)( ?${commandInfo.pattern}(?=\\b|$))(.*)`,
                "is"
            ) || false;
    }
    commandInfo.dontAddCommandList = commandInfo.dontAddCommandList || false;
    commandInfo.fromMe = commandInfo.fromMe || false;
    commandInfo.type = commandInfo.type || "misc";

    commands.push(commandInfo);
    return commandInfo;
};

export { commands };
