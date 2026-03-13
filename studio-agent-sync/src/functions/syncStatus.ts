/**
 * syncStatus.ts
 * Azure Function HTTP Trigger — returns current sync status and stats.
 * Called by the AI Hub dashboard to display sync health.
 *
 * GET /api/syncStatus
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getAllMappings } from "../services/relevanceService";

import "isomorphic-fetch";

export async function syncStatusHandler(
  _req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const mappings = await getAllMappings();

    const active = mappings.filter((m) => m.status === "active");
    const inactive = mappings.filter((m) => m.status === "inactive");
    const admins = mappings.filter((m) => m.role === "admin");

    // Find most recent sync timestamp
    const lastSynced = mappings.reduce((latest, m) => {
      if (!m.last_synced) return latest;
      return m.last_synced > latest ? m.last_synced : latest;
    }, "");

    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "healthy",
        total_mappings: mappings.length,
        active_employees: active.length,
        inactive_employees: inactive.length,
        admin_users: admins.length,
        last_synced: lastSynced || null,
        tenant_id: process.env.AZURE_TENANT_ID,
      }),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    context.error(`syncStatus error: ${msg}`);
    return {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "error",
        error: msg,
      }),
    };
  }
}

app.http("syncStatus", {
  methods: ["GET"],
  authLevel: "function",
  handler: syncStatusHandler,
});
