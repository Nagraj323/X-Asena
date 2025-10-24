import fs from "fs/promises";
import path from "path";
import config from "./config.js";
import connect from "./src/socket/connection.js";

global.__basedir = path.resolve();

const readAndRequireFiles = async (directory) => {
    try {
        const files = await fs.readdir(directory);
        const jsFiles = files.filter(file => file.endsWith(".js"));
        await Promise.all(
            jsFiles.map(file =>
                import(`file://${path.join(directory, file).replace(/\\/g, "/")}`)
            )
        );
    } catch (error) {
        console.error("Error loading files:", error);
        throw error;
    }
};

const initialize = async () => {
    console.log("X-Asena");
    try {
        await readAndRequireFiles(path.join(global.__basedir, "src/database"));
        console.log("Syncing Database");
        await config.DATABASE.sync();
        console.log("✅ Plugins Installed!");
        await connect();
    } catch (error) {
        console.error("Initialization error:", error);
        process.exit(1);
    }
};

initialize();
