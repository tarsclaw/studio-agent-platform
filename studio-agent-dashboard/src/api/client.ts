import type {
  EventsResponse,
  HourlyResponse,
  SummaryResponse,
  ToolsResponse,
  TrendsResponse,
  UsersResponse,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TENANT_ID = import.meta.env.VITE_TENANT_ID;

function buildUrl(path: string): URL {
  if (BASE_URL.startsWith('http://') || BASE_URL.startsWith('https://')) {
    return new URL(`${BASE_URL}${path}`);
  }
  return new URL(`${BASE_URL}${path}`, window.location.origin);
}

async function fetchDashboard<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  if (!TENANT_ID) {
    throw new Error('Missing VITE_TENANT_ID. Set it in your environment configuration.');
  }

  const url = buildUrl('/dashboard');
  url.searchParams.set('tenant_id', TENANT_ID);
  url.searchParams.set('endpoint', endpoint);

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString());

  if (res.status === 401) {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/dashboard';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

const emptySummary = (period?: string): SummaryResponse => ({
  tenant_id: TENANT_ID || '',
  period: period || '',
  has_turn_data: false,
  hero_metrics: {
    cost_saved: 0,
    hours_saved: 0,
    self_service_rate: 0,
    total_conversations: 0,
    total_tool_executions: 0,
    unique_users: 0,
    avg_latency_ms: 0,
    p95_latency_ms: 0,
    error_rate: 0,
    employee_turns: 0,
    admin_turns: 0,
    projected_annual_savings: 0,
    projected_annual_hours: 0,
  },
  top_tools: [],
});

const emptyTrends = (): TrendsResponse => ({
  tenant_id: TENANT_ID || '',
  from: '',
  to: '',
  days: [],
});

const emptyTools = (period?: string): ToolsResponse => ({
  tenant_id: TENANT_ID || '',
  period: period || '',
  tools: [],
  category_totals: [],
});

const emptyHourly = (period?: string): HourlyResponse => ({
  tenant_id: TENANT_ID || '',
  period: period || '',
  total_events: 0,
  peak_hour: null,
  peak_day: null,
  by_hour: [],
  by_day_of_week: [],
  by_category: [],
});

const emptyUsers = (period?: string): UsersResponse => ({
  tenant_id: TENANT_ID || '',
  period: period || '',
  total_unique_users: 0,
  avg_conversations_per_user: 0,
  avg_tool_executions_per_user: 0,
  users: [],
});

export const api = {
  summary: async (period?: string) => {
    try {
      return await fetchDashboard<SummaryResponse>('summary', period ? { period } : undefined);
    } catch {
      return emptySummary(period);
    }
  },

  trends: async (from?: string, to?: string) => {
    try {
      return await fetchDashboard<TrendsResponse>('trends', {
        ...(from && { from }),
        ...(to && { to }),
      });
    } catch {
      return emptyTrends();
    }
  },

  tools: async (period?: string) => {
    try {
      return await fetchDashboard<ToolsResponse>('tools', period ? { period } : undefined);
    } catch {
      return emptyTools(period);
    }
  },

  events: (correlationId: string) =>
    fetchDashboard<EventsResponse>('events', { correlation_id: correlationId }),

  hourly: async (period?: string) => {
    try {
      return await fetchDashboard<HourlyResponse>('hourly', period ? { period } : undefined);
    } catch {
      return emptyHourly(period);
    }
  },

  users: async (period?: string) => {
    try {
      return await fetchDashboard<UsersResponse>('users', period ? { period } : undefined);
    } catch {
      return emptyUsers(period);
    }
  },
};
