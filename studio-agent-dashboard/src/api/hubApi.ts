/**
 * src/api/hubApi.ts
 *
 * API client for the Studio Agent Dashboard backend (port 3979 / /api/* in prod).
 * Separate from the analytics client (client.ts) — different origin, different auth.
 *
 * Base URL
 *   VITE_HUB_API_BASE  — set to http://localhost:3979 in dev
 *                      — leave empty (default) for same-origin in production
 *
 * Auth
 *   Requests include Authorization: Bearer <token> when a token is available.
 *   The backend returns 503 (auth not yet configured) or 401 (invalid token)
 *   until AZURE_AD_TENANT_ID + AZURE_AD_CLIENT_ID are set (John Jobling / Allect IT).
 *   The UI handles both states gracefully rather than crashing.
 */

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

async function hubFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${HUB_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!res.ok) {
    let body: HubApiError = { error: 'unknown', message: `HTTP ${res.status}` };
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — keep default
    }
    throw new HubApiResponseError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export const hubApi = {
  chat: (req: ChatRequest): Promise<ChatResponse> =>
    hubFetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
};
