/**
 * src/relevanceClient.ts
 *
 * Shared Relevance AI client utilities.
 * Extracted from app.ts so both the Teams relay and the dashboard chatProxy
 * can share the same SDK initialisation and waitForBestAgentReply pattern
 * without duplicating code.
 *
 * IMPORTANT: This module must never import from app.ts — the Teams relay is a
 * protected surface.  app.ts imports from here, not the other way round.
 */

import * as RelevanceSDK from "@relevanceai/sdk";

const { Agent, createClient } = RelevanceSDK as any;

// -------------------------
// Region resolution
// -------------------------

/**
 * Maps a human-readable region string ("EU", "AU", "US") to the SDK's internal
 * stack-code constant.  Exported so app.ts can use it for its own startup logs
 * without re-implementing the mapping.
 */
export function resolveRegion(input?: string): string {
  const sdk: any = RelevanceSDK as any;

  if (!sdk.REGION_US || !sdk.REGION_EU || !sdk.REGION_AU) {
    throw new Error(
      "SDK missing REGION_US/EU/AU exports. Confirm @relevanceai/sdk version and exports."
    );
  }

  const r = (input || "US").toUpperCase();
  if (r === "EU") return sdk.REGION_EU;
  if (r === "AU") return sdk.REGION_AU;
  return sdk.REGION_US;
}

// -------------------------
// Client init (idempotent)
// -------------------------

let clientInitialized = false;

/**
 * Initialise the Relevance SDK global client once.
 * Safe to call from multiple modules — subsequent calls are no-ops.
 * Reads RELEVANCE_API_KEY, RELEVANCE_PROJECT_ID / PROJECT_ID, RELEVANCE_REGION from env.
 */
export function initRelevanceClient(): void {
  if (clientInitialized) return;

  const apiKey = process.env.RELEVANCE_API_KEY;
  const project = process.env.RELEVANCE_PROJECT_ID || process.env.PROJECT_ID;

  if (!apiKey || !project) {
    console.warn(
      "[RelevanceClient] Missing RELEVANCE_API_KEY or RELEVANCE_PROJECT_ID — client not initialised."
    );
    return;
  }

  const region = resolveRegion(process.env.RELEVANCE_REGION);

  console.log("[RelevanceClient] Using project:", project);
  console.log("[RelevanceClient] Using env RELEVANCE_REGION:", process.env.RELEVANCE_REGION);
  console.log("[RelevanceClient] Resolved region stack code:", region);

  createClient({ apiKey, region, project });
  clientInitialized = true;
  console.log("[RelevanceClient] Client initialised.");
}

// -------------------------
// Agent factory (cached per agent ID)
// -------------------------

const agentCache = new Map<string, Promise<any>>();

/**
 * Returns (and caches) a Relevance Agent instance for the given agentId.
 * initRelevanceClient() must be called before this.
 */
export function getRelevanceAgent(agentId: string): Promise<any> {
  if (!agentCache.has(agentId)) {
    agentCache.set(agentId, Agent.get(agentId));
  }
  return agentCache.get(agentId)!;
}

// -------------------------
// Task waiting (events-driven)
// -------------------------

/**
 * Waits for the best agent reply from a Relevance SDK task.
 *
 * Extracted verbatim from app.ts.  Behaviour is identical — do not alter the
 * event-listener logic without coordinating with the Teams relay.
 *
 * Resolves with the agent's reply text.
 * Rejects on hard timeout (default 120 s) or task error.
 */
export async function waitForBestAgentReply(
  task: any,
  opts?: { timeoutMs?: number; settleMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const settleMs = opts?.settleMs ?? 1500;

  return await new Promise<string>((resolve, reject) => {
    let latestAgentText = "";
    let settled = false;

    let settleTimer: NodeJS.Timeout | null = null;
    const resetSettleTimer = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (latestAgentText) finishResolve(latestAgentText);
      }, settleMs);
    };

    const hardTimeout = setTimeout(
      () => finishReject(new Error("Timed out waiting for agent reply")),
      timeoutMs
    );

    const cleanup = () => {
      clearTimeout(hardTimeout);
      if (settleTimer) clearTimeout(settleTimer);
      task.removeEventListener("message", onMessage as any);
      task.removeEventListener("error", onError as any);
      task.removeEventListener("update", onUpdate as any);
      try {
        task.unsubscribe();
      } catch {}
    };

    const finishResolve = (text: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(text);
    };

    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onMessage = ({ detail: { message } }: any) => {
      if (message?.isAgent && typeof message.isAgent === "function" && message.isAgent()) {
        latestAgentText = String(message.text ?? "");
        resetSettleTimer();
      }
    };

    const onError = ({ detail: { message } }: any) => {
      const lastError = message?.lastError ? String(message.lastError) : "Unknown task error";
      finishReject(new Error(lastError));
    };

    const onUpdate = () => {
      const status = String(task?.status ?? "");
      if (status === "idle" && latestAgentText) finishResolve(latestAgentText);
      if (status === "error") finishReject(new Error("Task entered error status"));
    };

    task.addEventListener("message", onMessage as any);
    task.addEventListener("error", onError as any);
    task.addEventListener("update", onUpdate as any);
  });
}
