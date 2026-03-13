import { App } from "@microsoft/teams.apps";
import { LocalStorage } from "@microsoft/teams.common";

import * as RelevanceSDK from "@relevanceai/sdk";

import {
  initTelemetry,
  trackEvent,
  trackDependency,
  trackException,
  hashUser,
} from "./telemetry";

import {
  initRelevanceClient,
  waitForBestAgentReply,
} from "./src/relevanceClient";

// ★ NEW IMPORT — wires up your dead telemetryQueue.ts
import { enqueueTelemetry } from "./telemetryQueue";

// ★ NEW IMPORT — the turn envelope builder
import { buildTurnEnvelope } from "./turnEnvelope";

const { Agent } = RelevanceSDK as any;

export const app = new App({
  storage: new LocalStorage(),
});

// init telemetry once at module load
initTelemetry();

function stripMentionsText(text: string) {
  return text.replace(/<at[^>]*>.*?<\/at>/gi, "").trim();
}

// ★ NEW HELPER — detects which bot type this relay serves
// Set AGENT_TYPE env var to "employee" or "admin"
function detectAgentType(): "employee" | "admin" {
  return (process.env.AGENT_TYPE as "employee" | "admin") || "employee";
}

// -------------------------
// Relevance SDK init (once, via shared module)
// -------------------------
const agentId = process.env.RELEVANCE_AGENT_ID;

console.log("[Relevance] Using agentId:", agentId);

// initRelevanceClient() is idempotent — logs project + region and calls
// createClient() exactly once across the whole process.
initRelevanceClient();

let agentPromise: Promise<any> | null = null;
async function getAgent() {
  if (!agentId) throw new Error("Missing RELEVANCE_AGENT_ID");
  if (!process.env.RELEVANCE_API_KEY) throw new Error("Missing RELEVANCE_API_KEY");
  if (!process.env.RELEVANCE_PROJECT_ID && !process.env.PROJECT_ID)
    throw new Error("Missing RELEVANCE_PROJECT_ID (or PROJECT_ID)");
  if (!agentPromise) agentPromise = Agent.get(agentId);
  return agentPromise;
}

// -------------------------
// Per-thread mutex
// -------------------------
const threadLocks = new Map<string, Promise<void>>();

async function withThreadLock(threadId: string, fn: () => Promise<void>) {
  const prev = threadLocks.get(threadId) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => (release = res));
  threadLocks.set(threadId, prev.then(() => next));

  await prev;
  try {
    await fn();
  } finally {
    release();
    if (threadLocks.get(threadId) === next) threadLocks.delete(threadId);
  }
}

function taskKey(threadId: string) {
  return `relevance_task_id:${threadId}`;
}

// -------------------------
// Main Teams handler
// -------------------------
app.on("message", async ({ activity, send, storage, next }) => {
  const turnStart = Date.now();
  const _next = typeof next === "function" ? next : async () => {};

  const rawText = activity.text ?? "";
  const text = stripMentionsText(rawText).trim();

  if (!text) {
    await _next();
    return;
  }

  const tenant_id =
    (activity.conversation as any)?.tenantId ?? (activity.channelData as any)?.tenant?.id ?? "";
  const aad_object_id = (activity.from as any)?.aadObjectId ?? "";
  const conversation_id = activity.conversation?.id ?? "";

  const correlation_id = activity.id ?? `${conversation_id}:${Date.now()}`;

  const user_hash =
    tenant_id && aad_object_id ? hashUser(`${tenant_id}:${aad_object_id}`) : "";

  // ★ REMOVED: the old "message_received" trackEvent was here
  // It's now captured in the turn envelope at the end

  if (!tenant_id || !aad_object_id || !conversation_id) {
    trackEvent({
      name: "missing_identity",
      properties: {
        correlation_id,
        tenant_id: tenant_id || "",
        conversation_id: conversation_id || "",
        has_aad_object_id: String(Boolean(aad_object_id)),
      },
    });

    await send("Missing tenant/user identity. Please retry from within Teams chat.");
    await _next();
    return;
  }

  const thread_id = `${tenant_id}:${conversation_id}`;
  const event_id = correlation_id;

  // ★ CHANGED: entire withThreadLock block refactored to use envelope pattern
  await withThreadLock(thread_id, async () => {
    await send("Thinking…");

    const depStart = Date.now();
    let depSuccess = false;
    let depResultCode = "unknown";
    let reply = "";

    try {
      const agent = await getAgent();

      const payloadStr = JSON.stringify({
        text,
        tenant_id,
        aad_object_id,
        conversation_id,
        thread_id,
        event_id,
        locale: (activity as any)?.locale ?? "",
        timestamp: (activity as any)?.timestamp ?? "",
        channelId: activity.channelId ?? "",
      });

      let task: any | null = null;
      const existingTaskId = storage.get(taskKey(thread_id)) as string | undefined;

      if (existingTaskId) {
        try {
          task = await agent.getTask(existingTaskId);
        } catch {
          task = null;
          try {
            (storage as any).delete(taskKey(thread_id));
          } catch {}
        }
      }

      if (task) {
        const replyPromise = waitForBestAgentReply(task, { timeoutMs: 120_000, settleMs: 1500 });
        await agent.sendMessage(payloadStr, task);
        reply = (await replyPromise) || "";
      } else {
        task = await agent.sendMessage(payloadStr);
        if (task?.id) storage.set(taskKey(thread_id), String(task.id));
        reply = (await waitForBestAgentReply(task, { timeoutMs: 120_000, settleMs: 1500 })) || "";
      }

      depSuccess = true;
      depResultCode = "ok";

      await send(reply || "No reply text received from agent.");

      // ★ REMOVED: old trackDependency and trackEvent("bot_response_sent") from here
      // They're replaced by the envelope in the finally block below

    } catch (e: any) {
      depSuccess = false;
      depResultCode = e?.response?.status ? String(e.response.status) : "error";

      trackException(e, { correlation_id, tenant_id, user_hash });

      console.error("[Relevance] Error:", e);
      const msg =
        e?.response?.data
          ? `Relevance SDK error: ${JSON.stringify(e.response.data)}`
          : `Relevance SDK error: ${e?.message ?? String(e)}`;
      reply = msg;
      await send(msg);

      // ★ REMOVED: old trackDependency and trackEvent("bot_response_sent") from here
      // They're replaced by the envelope in the finally block below

    } finally {
      // ★ NEW: Build and emit ONE canonical turn envelope
      // This replaces all the fragmented trackEvent/trackDependency calls
      const envelope = buildTurnEnvelope({
        tenantId: tenant_id,
        userHash: user_hash,
        conversationId: conversation_id,
        correlationId: correlation_id,
        channel: String(activity.channelId || "msteams"),
        agentType: detectAgentType(),
        inputText: text,
        responseText: reply,
        startTime: turnStart,
        relevanceDurationMs: Date.now() - depStart,
        relevanceResultCode: depResultCode,
        error: depSuccess ? undefined : new Error(depResultCode),
      });

      // ★ Dual-write: App Insights (keeps your existing queries working)
      trackEvent({
        name: "turn_completed",
        properties: {
          correlation_id: envelope.correlation_id,
          tenant_id: envelope.tenant_id,
          user_hash: envelope.user_hash,
          conversation_id: envelope.conversation_id,
          channel: envelope.channel,
          agent_type: envelope.agent_type,
          outcome: envelope.outcome,
          relevance_result_code: envelope.relevance_result_code,
          error_message: envelope.error_message || "",
        },
        measurements: {
          input_chars: envelope.input_chars,
          response_chars: envelope.response_chars,
          latency_total_ms: envelope.latency_total_ms,
          relevance_duration_ms: envelope.relevance_duration_ms,
        },
      });

      // ★ Queue write: feeds the analytics pipeline (this wires up telemetryQueue.ts!)
      try {
        await enqueueTelemetry(envelope);
      } catch (queueErr) {
        // Never let a queue failure break the bot
        trackException(queueErr as Error, { correlation_id, tenant_id, user_hash });
      }
    }
  });

  await _next();
});