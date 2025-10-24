import fs from "fs/promises";
import path from "path";
import config from "./config.js";
import connect from "./src/socket/connection.js";
import { commands } from "./src/plugins.js";
import { initTerminalHandler } from "./src/terminal/handler.js";
import { validateAuthState, getAuthStateStats } from "./src/database/authState.js";

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
    console.log("\n╔══════════════════════════════╗");
    console.log("║        X-Asena v4.0.0       ║");
    console.log("║   Baileys 7.x.x Compatible  ║");
    console.log("╚══════════════════════════════╝\n");
    
    try {
        // Initialize database
        await readAndRequireFiles(path.join(global.__basedir, "src/database"));
        console.log("⏳ Syncing Database...");
        await config.DATABASE.sync();
        console.log("✅ Database Synced!");
        
        // Load plugins
        await readAndRequireFiles(path.join(global.__basedir, "src/plugins"));
        console.log(`✅ ${commands.length} Plugins Loaded!`);
        
        // Validate auth state
        console.log("🔍 Validating auth state...");
        const validation = await validateAuthState();
        
        if (validation.stats) {
            console.log(`📊 Auth State: ${validation.stats.sessions} sessions, ${validation.stats.preKeys} pre-keys, ${validation.stats.lidMappings} LID mappings`);
        }
        
        if (!validation.valid && validation.issues) {
            console.warn("⚠️  Auth state issues detected:");
            validation.issues.forEach(issue => console.warn(`   - ${issue}`));
            
            if (validation.issues.includes('No credentials found')) {
                console.log("ℹ️  First time setup - will create new credentials");
            }
        } else if (validation.valid) {
            console.log("✅ Auth state validated successfully");
        }
        
        // Initialize terminal handler (keyboard shortcuts)
        initTerminalHandler();
        
        // Start connection
        console.log("⏳ Connecting to WhatsApp...\n");
        await connect();
        
    } catch (error) {
        console.error("❌ Initialization error:", error);
        process.exit(1);
    }
};

initialize();
