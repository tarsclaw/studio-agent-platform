// postTelemetryToRelevance.ts — UPDATED
// What changed: added Table Storage write BEFORE forwarding to Relevance.
// Everything else is your original code, untouched.

import { app, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";  // ★ NEW

// ★ NEW — Table Storage setup
const connectionString =
  process.env.TELEMETRY_QUEUE_CONNECTION_STRING ||
  process.env.AzureWebJobsStorage ||
  "";

const eventsTable = TableClient.fromConnectionString(connectionString, "telemetryevents");
let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await eventsTable.createTable().catch(() => {}); // Ignore "already exists"
  tableReady = true;
}

// ★ NEW — writes the event to Table Storage for analytics
async function writeToTableStorage(envelope: any, context: InvocationContext): Promise<void> {
  try {
    await ensureTable();

    const tenantId = envelope.tenant_id || "unknown";
    const ts = envelope.timestamp || new Date().toISOString();
    const id = envelope.correlation_id || envelope.event_id || Math.random().toString(36).slice(2, 10);
    const eventType = envelope.event_type || "turn_completed";

    // Inverted timestamp = newest rows first when querying
    const invertedTs = String(9999999999999 - new Date(ts).getTime()).padStart(13, "0");

    const entity: any = {
      partitionKey: tenantId,
      rowKey: `${invertedTs}_${eventType}_${id}`,
      eventType: eventType,
      timestamp: ts,
      payload: JSON.stringify(envelope),
    };

    // Flatten key fields for direct querying
    if (eventType === "turn_completed") {
      entity.correlationId = envelope.correlation_id || "";
      entity.userHash = envelope.user_hash || "";
      entity.outcome = envelope.outcome || "";
      entity.agentType = envelope.agent_type || "";
      entity.latencyTotalMs = envelope.latency_total_ms || 0;
    } else if (eventType === "tool_executed") {
      entity.toolName = envelope.tool_name || "";
      entity.toolCategory = envelope.tool_category || "";
      entity.success = envelope.success ?? true;
    }

    await eventsTable.createEntity(entity);
    context.log(`[Table Storage] Stored ${eventType}: ${entity.rowKey}`);
  } catch (err: any) {
    if (err.statusCode === 409) {
      context.log(`[Table Storage] Duplicate skipped`);
    } else {
      context.log(`[Table Storage] Write failed (non-blocking): ${err.message}`);
    }
    // Never block the Relevance forward if Table Storage fails
  }
}

// ── Your existing code below, unchanged ──────────────────────────────────────

function parseQueuePayload(queueItem: string) {
  // 1) Plain JSON
  try {
    return JSON.parse(queueItem);
  } catch {}

  // 2) base64(JSON)
  try {
    const s1 = Buffer.from(queueItem, "base64").toString("utf8");
    return JSON.parse(s1);
  } catch {}

  // 3) base64(base64(JSON)) - defensive
  const s1 = Buffer.from(queueItem, "base64").toString("utf8");
  const s2 = Buffer.from(s1, "base64").toString("utf8");
  return JSON.parse(s2);
}

export async function postTelemetryToRelevance(queueItem: string, context: InvocationContext) {
  const envelope = parseQueuePayload(queueItem);

  // ★ NEW — write to Table Storage first (non-blocking)
  await writeToTableStorage(envelope, context);

  // ── Everything below is your original code, unchanged ──
  const url = process.env.RELEVANCE_TELEMETRY_WEBHOOK_URL;
  const key = process.env.RELEVANCE_TELEMETRY_WEBHOOK_KEY;

  if (!url) {
    context.log("Missing RELEVANCE_TELEMETRY_WEBHOOK_URL");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        "x-event-id": String((envelope as any)?.event_id || "")
      },
      body: JSON.stringify(envelope),
      signal: controller.signal
    });

    if (res.status === 429 || res.status >= 500) {
      throw new Error(`Retryable webhook response: ${res.status}`);
    }

    if (res.status >= 400) {
      context.log(`Non-retryable webhook response: ${res.status}`);
      return;
    }
  } finally {
    clearTimeout(timeout);
  }
}

app.storageQueue("postTelemetryToRelevance", {
  queueName: "bot-telemetry",
  connection: "TELEMETRY_QUEUE_CONNECTION_STRING",
  handler: postTelemetryToRelevance
});