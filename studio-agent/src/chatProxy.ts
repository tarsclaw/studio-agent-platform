/**
 * src/chatProxy.ts
 *
 * POST /api/chat
 *
 * Dashboard chat endpoint.  Forwards an authenticated user's message to the
 * Relevance AI employee agent and returns the reply as JSON.
 *
 * The agent is channel-agnostic: it handles messages from Teams and from the
 * web dashboard identically, driven by the same identity fields (tenant_id,
 * aad_object_id, conversation_id).  The resolver tool fires the same way in
 * both cases.
 *
 * Request
 *   Headers:  Authorization: Bearer <MSAL access token>
 *   Body:     { "text": "How many holiday days do I have left?",
 *               "conversation_id": "<optional, for thread continuity>" }
 *
 * Response
 *   200  { "reply": "...", "conversation_id": "..." }
 *   400  missing / empty text
 *   401  invalid / missing MSAL token
 *   502  Relevance AI error
 *   503  agent or auth not yet configured
 *
 * Agent selection
 *   Defaults to the employee agent (RELEVANCE_AGENT_ID env var).
 *   For dashboard admin mode, RELEVANCE_ADMIN_AGENT_ID may be used when the
 *   authenticated dashboard user resolves to role=admin.
 *
 * Auth dependency
 *   Requires deployed AZURE_AD_TENANT_ID + AZURE_AD_CLIENT_ID values that match
 *   the consented dashboard Entra app registration.
 *   requireMsalAuth returns 503 with a clear message until those are set.
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest, requireMsalAuth } from "./msalValidator";
import {
  initRelevanceClient,
  getRelevanceAgent,
  waitForBestAgentReply,
} from "./relevanceClient";
import { trackEvent, trackException } from "../telemetry";

// Ensure the Relevance SDK client is ready before any request arrives.
// initRelevanceClient() is idempotent — safe if app.ts already called it.
initRelevanceClient();

const router = Router();
const threadLocks = new Map<string, Promise<void>>();
const taskIdsByThread = new Map<string, string>();

function flagEnabled(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return value === "true";
}

function withThreadLock<T>(threadId: string, fn: () => Promise<T>): Promise<T> {
  const prev = threadLocks.get(threadId) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  threadLocks.set(threadId, prev.then(() => next));

  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
      if (threadLocks.get(threadId) === next) threadLocks.delete(threadId);
    }
  });
}

function getTaskKey(threadId: string): string | undefined {
  return taskIdsByThread.get(threadId);
}

function setTaskKey(threadId: string, taskId?: string): void {
  if (!taskId) return;
  taskIdsByThread.set(threadId, taskId);
}

function clearTaskKey(threadId: string): void {
  taskIdsByThread.delete(threadId);
}

router.post(
  "/",
  requireMsalAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as Record<string, unknown>;
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!flagEnabled("DASHBOARD_WIDGET_RELEVANCE_ENABLED", true)) {
      res.status(503).json({
        error: "widget_agent_disabled",
        message: "Studio Agent widget access is temporarily disabled in deployment configuration.",
      });
      return;
    }

    if (!text) {
      res.status(400).json({
        error: "missing_text",
        message: "Request body must include a non-empty 'text' field.",
      });
      return;
    }

    const tenant_id = auth.tid;
    const aad_object_id = auth.oid;
    const user_name = auth.name;
    const user_email = auth.email;
    const requestedRole = auth.role ?? "employee";
    const adminRoutingEnabled = flagEnabled("DASHBOARD_WIDGET_ADMIN_AGENT_ENABLED", true);
    const effectiveRole = requestedRole === "admin" && adminRoutingEnabled ? "admin" : "employee";

    if (requestedRole === "admin" && !adminRoutingEnabled) {
      trackEvent({
        name: "dashboard_widget_admin_routing_disabled",
        properties: {
          tenant_id,
          aad_object_id,
          requested_role: requestedRole,
        },
      });
    }

    const agentId = effectiveRole === "admin"
      ? (process.env.RELEVANCE_ADMIN_AGENT_ID || process.env.RELEVANCE_AGENT_ID)
      : process.env.RELEVANCE_AGENT_ID;

    if (!agentId) {
      res.status(503).json({
        error: "agent_not_configured",
        message:
          effectiveRole === "admin"
            ? "RELEVANCE_ADMIN_AGENT_ID (or fallback RELEVANCE_AGENT_ID) must be set for admin dashboard chat."
            : "RELEVANCE_AGENT_ID is not set. The employee agent ID must be provided to handle web chat requests.",
      });
      return;
    }

    const conversation_id =
      typeof body.conversation_id === "string" && body.conversation_id.trim()
        ? (body.conversation_id as string).trim()
        : `web:${aad_object_id}`;

    const thread_id = `${tenant_id}:${conversation_id}`;
    const event_id = uuidv4();
    const parityEnabled = flagEnabled("DASHBOARD_WIDGET_TEAMS_PARITY_ENFORCED", true);
    const strictIdentityResolution = flagEnabled("DASHBOARD_WIDGET_IDENTITY_RESOLUTION_STRICT", true);

    const payloadStr = JSON.stringify({
      text,
      tenant_id,
      aad_object_id,
      conversation_id,
      thread_id,
      event_id,
      channel: effectiveRole === "admin" ? "web-admin" : "web",
      role: effectiveRole,
      name: user_name,
      user_name,
      email: user_email,
      user_email,
      preferred_username: user_email,
      signed_in_user_oid: aad_object_id,
      subject_scope: effectiveRole === "admin" ? "org" : "self",
    });

    try {
      const run = async () => {
        const agent = await getRelevanceAgent(agentId);
        let task: any | null = null;

        if (parityEnabled) {
          const existingTaskId = getTaskKey(thread_id);
          if (existingTaskId) {
            try {
              task = await agent.getTask(existingTaskId);
            } catch {
              task = null;
              clearTaskKey(thread_id);
            }
          }
        }

        let reply = "";
        if (task) {
          const replyPromise = waitForBestAgentReply(task, { timeoutMs: 120_000, settleMs: 1500 });
          await agent.sendMessage(payloadStr, task);
          reply = (await replyPromise) || "";
        } else {
          task = await agent.sendMessage(payloadStr);
          if (parityEnabled && task?.id) setTaskKey(thread_id, String(task.id));
          reply = (await waitForBestAgentReply(task, { timeoutMs: 120_000, settleMs: 1500 })) || "";
        }

        const lowerReply = reply.toLowerCase();
        const sandboxFixtureDetected =
          lowerReply.includes("john smith") ||
          lowerReply.includes("sandbox") ||
          lowerReply.includes("allect ltd - sandbox");

        trackEvent({
          name: "dashboard_widget_turn_completed",
          properties: {
            tenant_id,
            aad_object_id,
            conversation_id,
            effective_role: effectiveRole,
            requested_role: requestedRole,
            agent_id: agentId,
            parity_enabled: String(parityEnabled),
            strict_identity_resolution: String(strictIdentityResolution),
            sandbox_fixture_detected: String(sandboxFixtureDetected),
          },
          measurements: {
            input_chars: text.length,
            reply_chars: reply.length,
          },
        });

        return reply;
      };

      const reply = parityEnabled ? await withThreadLock(thread_id, run) : await run();
      res.json({ reply: reply || "", conversation_id, role: effectiveRole, agent_id: agentId });
    } catch (err: unknown) {
      const e = err as any;
      const message = e?.message ?? "Unexpected error communicating with agent.";
      const lowerMessage = String(message).toLowerCase();

      trackException(err as Error, {
        channel: "web",
        tenant_id,
        aad_object_id,
        requested_role: requestedRole,
        effective_role: effectiveRole,
      });
      console.error("[chatProxy] Error:", e);

      if (
        strictIdentityResolution &&
        (lowerMessage.includes("not_linked") ||
          lowerMessage.includes("not linked") ||
          lowerMessage.includes("missing_oid") ||
          lowerMessage.includes("unable to establish user identity"))
      ) {
        res.status(403).json({
          error: "identity_not_resolved",
          message:
            "Your signed-in identity was verified, but Studio Agent could not safely map it to a person record. Please contact support rather than relying on a guessed identity.",
        });
        return;
      }

      res.status(502).json({
        error: "agent_error",
        message,
      });
    }
  }
);

export default router;
