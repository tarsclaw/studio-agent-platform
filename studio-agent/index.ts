import { app } from "./app";
import { initTelemetry } from "./telemetry";
import { startDashboardServer } from "./src/dashboardServer";

/**
 * Env var compatibility layer:
 * - Azure/App Service commonly uses MicrosoftAppId/MicrosoftAppPassword/MicrosoftAppTenantId
 * - Toolkit local runtime may use CLIENT_ID/CLIENT_SECRET/TENANT_ID
 * - Toolkit provisioning writes BOT_ID/SECRET_BOT_PASSWORD/TEAMS_APP_TENANT_ID into env files
 */
function normalizeBotEnv() {
  process.env.CLIENT_ID =
    process.env.CLIENT_ID || process.env.MicrosoftAppId || process.env.BOT_ID || "";

  process.env.CLIENT_SECRET =
    process.env.CLIENT_SECRET ||
    process.env.MicrosoftAppPassword ||
    process.env.SECRET_BOT_PASSWORD ||
    "";

  process.env.TENANT_ID =
    process.env.TENANT_ID ||
    process.env.MicrosoftAppTenantId ||
    process.env.TEAMS_APP_TENANT_ID ||
    "";
}

normalizeBotEnv();

// Ensure telemetry is initialized before starting the server
initTelemetry();

(async () => {
  await app.start();
  console.log(`Bot started, app listening on`, process.env.PORT || process.env.port || 3978);

  // Start dashboard API server in the same process on DASHBOARD_PORT (default 3979).
  // The Teams relay is untouched — each server manages its own port and concerns.
  startDashboardServer();
})();
