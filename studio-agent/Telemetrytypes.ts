// telemetryTypes.ts — goes in the SAME folder as app.ts, telemetry.ts, telemetryQueue.ts
//
// Shared type definitions for the HR Agent Analytics pipeline.
// Used by: turnEnvelope.ts, posterFunction.ts, dashboard frontend

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

export interface ToolExecutedEvent {
  event_type: "tool_executed";
  timestamp: string;
  tool_name: string;
  tool_category: "employee" | "admin";
  agent_id: string;
  conversation_id?: string;
  tenant_id?: string;
  success: boolean;
  error_message?: string;
  api_duration_ms?: number;
}

export type TelemetryEvent = TurnEnvelope | ToolExecutedEvent;

export const DEFAULT_BASELINE_MINUTES: Record<string, number> = {
  // Employee Self-Service (8 tools)
  get_my_employee_details: 3,
  create_my_leave_request: 5,
  list_my_absences: 3,
  list_my_bonuses: 4,
  list_departments: 2,
  list_divisions: 2,
  list_locations: 2,
  list_working_patterns: 2,
  // Admin Tools (21 tools)
  list_employees: 3,
  get_employee_details: 3,
  create_employee: 15,
  create_employee_change_request: 7,
  list_change_requests: 3,
  approve_change_request: 5,
  list_leave_requests: 3,
  get_leave_request: 3,
  create_leave_request: 5,
  approve_leave_request: 3,
  reject_leave_request: 5,
  list_absences: 3,
  cancel_absence: 5,
  list_all_bonuses: 3,
  list_employee_bonuses: 3,
  get_company_account_details: 3,
  list_holiday_allowances: 3,
};