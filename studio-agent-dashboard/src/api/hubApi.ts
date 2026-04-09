/**
 * src/api/hubApi.ts
 *
 * API client for the Studio Agent Dashboard backend (port 3979 / /api/* in prod).
 * Separate from the analytics client (client.ts) — different origin, different auth.
 */

import type { AttendanceResponse, HolidayAllowanceResponse, LeaveResponse } from './types';

const HUB_BASE: string = (import.meta.env.VITE_HUB_API_BASE as string | undefined) ?? '';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatRequest {
  text: string;
  conversation_id?: string;
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
}

export interface HubApiError {
  error: string;
  message: string;
}

export class HubApiResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: HubApiError,
  ) {
    super(body.message ?? `Hub API error: ${status}`);
  }
}

export class DashboardAuthStateError extends Error {
  constructor(
    public readonly code: 'token_unavailable' | 'auth_not_ready',
    message: string,
  ) {
    super(message);
  }
}

async function fetchWithToken<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const res = await fetch(`${HUB_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    let body: HubApiError = { error: 'unknown', message: `HTTP ${res.status}` };
    try {
      body = await res.json();
    } catch {
      // keep default body
    }
    throw new HubApiResponseError(res.status, body);
  }

  return res.json() as Promise<T>;
}

async function hubFetch<T>(path: string, init: RequestInit, token?: string | null): Promise<T> {
  if (!token) {
    throw new DashboardAuthStateError('token_unavailable', 'Dashboard token is not ready yet.');
  }
  return fetchWithToken<T>(path, init, token);
}

export const hubApi = {
  chat: (req: ChatRequest, token?: string | null): Promise<ChatResponse> =>
    hubFetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(req),
    }, token),

  attendance: (date: string, token?: string | null): Promise<AttendanceResponse> =>
    hubFetch<AttendanceResponse>(`/api/attendance?date=${encodeURIComponent(date)}`, {
      method: 'GET',
    }, token),

  holidayAllowances: (token?: string | null): Promise<HolidayAllowanceResponse> =>
    hubFetch<HolidayAllowanceResponse>('/api/holiday-allowances', {
      method: 'GET',
    }, token),

  leaveRequests: (params?: { status?: string; limit?: number }, token?: string | null): Promise<LeaveResponse> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return hubFetch<LeaveResponse>(`/api/leave-requests${query}`, { method: 'GET' }, token);
  },
};
