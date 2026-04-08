/**
 * src/dashboardServer.ts
 *
 * Assembles and starts the Express HTTP server for dashboard APIs.
 *
 * This server is intentionally isolated from the Teams bot relay:
 *   - Teams bot listens on PORT (default 3978, managed by @microsoft/teams.apps)
 *   - Dashboard API listens on DASHBOARD_PORT (default 3979)
 *   - Both run in the same Node.js process — no extra infra required
 *
 * Routes
 *   GET  /health           — unauthenticated liveness probe (Azure App Service)
 *   POST /api/chat         — chat proxy → Relevance AI employee agent
 *   GET  /api/attendance   — HR attendance data from Breathe HR
 *
 * CORS
 *   Set DASHBOARD_ALLOWED_ORIGIN to your dashboard origin
 *   (for example https://www.mystudioagent.ai) to enable browser access.
 *   Not set → no CORS headers (safe default for server-side-only access).
 */

import express, { type Express } from "express";
import chatRouter from "./chatProxy";
import attendanceRouter from "./attendanceProxy";
import holidayAllowanceRouter from "./holidayAllowanceProxy";
import leaveRouter from "./leaveProxy";

export function startDashboardServer(hostApp?: Express): void {
  const port = Number(process.env.DASHBOARD_PORT) || 3979;
  const allowedOrigins = (process.env.DASHBOARD_ALLOWED_ORIGIN ?? "")
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const app = hostApp ?? express();

  // Parse JSON bodies up to 1 MB
  app.use(express.json({ limit: "1mb" }));

  // CORS — enabled only for explicitly allowed origins.
  if (allowedOrigins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  // Unauthenticated health check for Azure App Service / load-balancer probes
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "studio-agent-dashboard-api" });
  });

  app.use("/api/chat", chatRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/holiday-allowances", holidayAllowanceRouter);
  app.use("/api/leave-requests", leaveRouter);

  if (hostApp) {
    console.log(`[Dashboard API] Mounted on main app listener`);
    return;
  }

  // Catch-all 404 only when serving the dashboard API as its own server.
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.listen(port, () => {
    console.log(`[Dashboard API] Listening on port ${port}`);
  });
}
