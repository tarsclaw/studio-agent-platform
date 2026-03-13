// turnEnvelope.ts — goes in the SAME folder as app.ts, telemetry.ts, telemetryQueue.ts
import { v4 as uuidv4 } from "uuid";

export interface TurnEnvelope {
  event_type: "turn_completed";
  timestamp: string;
  correlation_id: string;
  tenant_id: string;
  user_hash: string;
  conversation_id: string;
  channel: string;
  agent_type: "employee" | "admin";
  input_chars: number;
  response_chars: number;
  outcome: "success" | "empty_reply" | "error";
  error_message?: string;
  latency_total_ms: number;
  relevance_duration_ms: number;
  relevance_result_code: string;
  tools_used?: string[];
}

export interface TurnContext {
  tenantId: string;
  userHash: string;
  conversationId: string;
  correlationId: string;
  channel: string;
  agentType: "employee" | "admin";
  inputText: string;
  responseText: string;
  startTime: number;
  relevanceDurationMs: number;
  relevanceResultCode: string;
  error?: Error;
}

export function buildTurnEnvelope(ctx: TurnContext): TurnEnvelope {
  const now = Date.now();

  let outcome: TurnEnvelope["outcome"];
  if (ctx.error) {
    outcome = "error";
  } else if (!ctx.responseText || ctx.responseText.trim().length === 0) {
    outcome = "empty_reply";
  } else {
    outcome = "success";
  }

  return {
    event_type: "turn_completed",
    timestamp: new Date().toISOString(),
    correlation_id: ctx.correlationId,
    tenant_id: ctx.tenantId,
    user_hash: ctx.userHash,
    conversation_id: ctx.conversationId,
    channel: ctx.channel,
    agent_type: ctx.agentType,
    input_chars: ctx.inputText.length,
    response_chars: ctx.responseText?.length ?? 0,
    outcome,
    error_message: ctx.error?.message,
    latency_total_ms: now - ctx.startTime,
    relevance_duration_ms: ctx.relevanceDurationMs,
    relevance_result_code: ctx.relevanceResultCode,
  };
}