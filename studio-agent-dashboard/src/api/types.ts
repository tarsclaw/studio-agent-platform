export interface SummaryResponse {
  tenant_id: string;
  period: string;
  has_turn_data?: boolean;
  hero_metrics: {
    cost_saved: number;
    hours_saved: number;
    self_service_rate: number;
    total_conversations: number;
    total_tool_executions: number;
    unique_users: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    error_rate: number;
    employee_turns: number;
    admin_turns: number;
    projected_annual_savings: number;
    projected_annual_hours: number;
  };
  top_tools: Array<{ tool: string; count: number }>;
}

export interface TrendsResponse {
  tenant_id: string;
  from: string;
  to: string;
  days: Array<{
    date: string;
    total_turns: number;
    tool_executions: number;
    unique_users: number;
    success_rate: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    hours_saved: number;
    cost_saved: number;
    employee_turns: number;
    admin_turns: number;
    success_count: number;
    error_count: number;
    empty_reply_count: number;
    tool_counts: Record<string, number>;
  }>;
}

export interface ToolsResponse {
  tenant_id: string;
  period: string;
  tools: Array<{
    tool: string;
    category: string;
    executions: number;
    baseline_minutes_per: number;
    total_minutes_saved: number;
    hours_saved: number;
    cost_saved: number;
  }>;
  category_totals: Array<{
    category: string;
    executions: number;
    hours_saved: number;
    cost_saved: number;
  }>;
}

export interface HourlyResponse {
  tenant_id: string;
  period: string;
  total_events: number;
  peak_hour: { hour: number; count: number; label: string } | null;
  peak_day: { day_index: number; count: number; label: string } | null;
  by_hour: Array<{ hour: number; label: string; count: number }>;
  by_day_of_week: Array<{ day_index: number; label: string; count: number }>;
  by_category: Array<{ category: string; count: number }>;
}

export interface UsersResponse {
  tenant_id: string;
  period: string;
  total_unique_users: number;
  avg_conversations_per_user: number;
  avg_tool_executions_per_user: number;
  users: Array<{
    user_hash: string;
    conversations: number;
    tool_executions: number;
    first_seen: string;
    last_seen: string;
    top_tools: Array<{ tool: string; count: number }>;
    agent_types: Record<string, number>;
  }>;
}

export interface EventsResponse {
  tenant_id: string;
  correlation_id: string;
  events: any[];
}

export interface AttendanceGroupCounts {
  absent: number;
  present: number;
}

export interface AttendanceAbsenceRecord {
  employeeName: string;
  type: string;
  brand: string;
  location: string;
  department: string;
  startDate: string;
  endDate: string;
}

export interface AttendanceResponse {
  date: string;
  totalEmployees: number;
  totalAbsent: number;
  totalPresent: number;
  absences: AttendanceAbsenceRecord[];
  byBrand: Record<string, AttendanceGroupCounts>;
  byLocation: Record<string, AttendanceGroupCounts>;
}

export interface HolidayAllowancePolicyBrandMix {
  brand: string;
  count: number;
}

export interface HolidayAllowancePolicy {
  id: number | null;
  name: string;
  units: string;
  amount: number | null;
  employeeCount: number;
  defaultPolicy: boolean;
  carryoverAllowed: boolean;
  dependsOnService: boolean;
  brandMix: HolidayAllowancePolicyBrandMix[];
}

export interface HolidayAllowanceResponse {
  totalEmployees: number;
  totalPolicies: number;
  defaultPolicy: HolidayAllowancePolicy | null;
  policies: HolidayAllowancePolicy[];
  totalsByBrand: HolidayAllowancePolicyBrandMix[];
}
