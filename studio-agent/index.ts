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
  // Mount dashboard API routes onto the main Express listener before starting the bot/app.
  // This makes /api/chat and related routes reachable on the public App Service host,
  // instead of an internal side port that Azure does not expose.
  startDashboardServer((app as any).http.express as any);

  await app.start();
  console.log(`Bot started, app listening on`, process.env.PORT || process.env.port || 3978);
})();
