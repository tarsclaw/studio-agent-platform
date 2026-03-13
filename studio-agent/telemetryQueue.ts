// telemetryQueue.ts
import { QueueClient } from "@azure/storage-queue";

const conn = process.env.TELEMETRY_QUEUE_CONNECTION_STRING;
const queueName = process.env.TELEMETRY_QUEUE_NAME;

let client: QueueClient | null = null;

function getClient(): QueueClient | null {
  if (!conn || !queueName) return null;
  if (!client) client = new QueueClient(conn, queueName);
  return client;
}

/**
 * Never throw: telemetry must not break the Teams turn.
 */
export async function enqueueTelemetry(envelope: unknown): Promise<void> {
  const qc = getClient();
  if (!qc) return;

  try {
    const json = JSON.stringify(envelope);
    const body = Buffer.from(json, "utf8").toString("base64");
    await qc.sendMessage(body);
  } catch {
    // swallow
  }
}
