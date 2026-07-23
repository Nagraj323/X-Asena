/**
 * Lightweight admin HTTP — health, metrics, audit (token-protected)
 * Bind localhost by default.
 */

import http from "http";
import { getMetricsSnapshot, metricsPrometheus } from "./metrics.js";
import { queryAudit } from "./audit.js";
import { getFlags } from "./flags.js";
import { getPolicies } from "./policy.js";
import { queueStats } from "./queue.js";
import { getMode } from "../utils/access.js";
import { getLogGroupJid, isSetupDone } from "../utils/logGroup.js";
import { BOT_INFO } from "../config/constants.js";
import { checkFfmpeg } from "../onboarding/setup.js";
import logger from "../utils/logger.js";

let server = null;

function auth(req, token) {
  if (!token) return false;
  const h = req.headers.authorization || "";
  if (h === `Bearer ${token}`) return true;
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("token") === token;
}

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

export function startAdminHttp() {
  const port = Number(process.env.ADMIN_HTTP_PORT || 0);
  if (!port) {
    logger.info?.("Admin HTTP disabled (set ADMIN_HTTP_PORT to enable)");
    return null;
  }

  const host = process.env.ADMIN_HTTP_HOST || "127.0.0.1";
  const token = process.env.ADMIN_HTTP_TOKEN || "";

  if (!token) {
    console.warn(
      "[admin-http] ADMIN_HTTP_PORT set but ADMIN_HTTP_TOKEN missing — refusing to start"
    );
    return null;
  }

  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}`);
      const path = url.pathname;

      // Health is open on localhost only (still require token if remotely bound)
      if (path === "/health") {
        const ff = await checkFfmpeg();
        return json(res, 200, {
          ok: true,
          name: BOT_INFO.NAME,
          version: BOT_INFO.VERSION,
          mode: await getMode(),
          ffmpeg: ff.ok,
          setup: await isSetupDone(),
          logGroup: !!(await getLogGroupJid()),
          queue: queueStats(),
        });
      }

      if (!auth(req, token)) {
        return json(res, 401, { error: "unauthorized" });
      }

      if (path === "/metrics" && url.searchParams.get("format") === "prom") {
        res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
        res.end(metricsPrometheus());
        return;
      }

      if (path === "/metrics") {
        return json(res, 200, getMetricsSnapshot());
      }

      if (path === "/flags") {
        return json(res, 200, await getFlags());
      }

      if (path === "/policies") {
        return json(res, 200, await getPolicies());
      }

      if (path === "/audit") {
        const limit = Number(url.searchParams.get("limit") || 50);
        const action = url.searchParams.get("action") || undefined;
        return json(res, 200, await queryAudit({ limit, action }));
      }

      if (path === "/") {
        return json(res, 200, {
          service: BOT_INFO.NAME,
          endpoints: [
            "GET /health",
            "GET /metrics",
            "GET /metrics?format=prom",
            "GET /flags",
            "GET /policies",
            "GET /audit?limit=50",
          ],
        });
      }

      return json(res, 404, { error: "not_found" });
    } catch (err) {
      return json(res, 500, { error: err?.message || "error" });
    }
  });

  server.listen(port, host, () => {
    console.log(`🛡 Admin HTTP on http://${host}:${port} (token required except notes)`);
    console.log(`   /health is open; /metrics /audit /flags need Bearer token`);
  });

  return server;
}

export function stopAdminHttp() {
  if (server) {
    server.close();
    server = null;
  }
}
