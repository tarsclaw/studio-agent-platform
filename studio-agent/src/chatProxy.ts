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
 *   Blocked on AZURE_AD_TENANT_ID + AZURE_AD_CLIENT_ID (John Jobling / Allect IT).
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
import { trackException } from "../telemetry";

// Ensure the Relevance SDK client is ready before any request arrives.
// initRelevanceClient() is idempotent — safe if app.ts already called it.
initRelevanceClient();

const router = Router();

router.post(
  "/",
  requireMsalAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const auth = (req as AuthenticatedRequest).auth!;

    const body = req.body as Record<string, unknown>;
    const text =
      typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      res.status(400).json({
        error: "missing_text",
        message: "Request body must include a non-empty 'text' field.",
      });
      return;
    }

    const dashboardRole = auth.role ?? 'employee';
    const agentId = dashboardRole === 'admin'
      ? (process.env.RELEVANCE_ADMIN_AGENT_ID || process.env.RELEVANCE_AGENT_ID)
      : process.env.RELEVANCE_AGENT_ID;
    if (!agentId) {
      res.status(503).json({
        error: "agent_not_configured",
        message:
          dashboardRole === 'admin'
            ? "RELEVANCE_ADMIN_AGENT_ID (or fallback RELEVANCE_AGENT_ID) must be set for admin dashboard chat."
            : "RELEVANCE_AGENT_ID is not set. The employee agent ID must be provided to handle web chat requests.",
      });
      return;
    }

    const tenant_id = auth.tid;
    const aad_object_id = auth.oid;
    const user_name = auth.name;
    const user_email = auth.email;

    // Callers may pass a conversation_id to maintain thread continuity across
    // multiple requests.  If absent, a stable per-user ID is derived.
    const conversation_id =
      typeof body.conversation_id === "string" && body.conversation_id.trim()
        ? (body.conversation_id as string).trim()
        : `web:${aad_object_id}`;

    const thread_id = `${tenant_id}:${conversation_id}`;
    const event_id = uuidv4();

    const payloadStr = JSON.stringify({
      text,
      tenant_id,
      aad_object_id,
      conversation_id,
      thread_id,
      event_id,
      channel: dashboardRole === 'admin' ? 'web-admin' : 'web',
      role: dashboardRole,
      name: user_name,
      user_name,
      email: user_email,
      user_email,
      preferred_username: user_email,
    });

    try {
      const agent = await getRelevanceAgent(agentId);
      const task = await agent.sendMessage(payloadStr);
      const reply = await waitForBestAgentReply(task, {
        timeoutMs: 120_000,
        settleMs: 1500,
      });

      res.json({ reply: reply || "", conversation_id, role: dashboardRole, agent_id: agentId });
    } catch (err: unknown) {
      const e = err as any;
      trackException(err as Error, { channel: "web", tenant_id, aad_object_id });
      console.error("[chatProxy] Error:", e);
      res.status(502).json({
        error: "agent_error",
        message: e?.message ?? "Unexpected error communicating with agent.",
      });
    }
  }
);

export default router;
