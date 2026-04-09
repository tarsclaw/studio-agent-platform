import { acquireAccessToken, getActiveAccount, isMsalInteractionInProgress, loginWithMsal, msalEnabled } from '../msalConfig';

export interface User {
  name: string;
  email: string;
}

const LOCAL_AUTH_BYPASS = import.meta.env.VITE_LOCAL_AUTH_BYPASS === 'true';
const LOGIN_ATTEMPT_KEY = 'studio_agent_msal_login_started';
const LOGIN_ATTEMPT_AT_KEY = 'studio_agent_msal_login_started_at';
const LOGIN_ATTEMPT_STALE_MS = 2 * 60 * 1000;

function devUser(): User {
  return {
    name: import.meta.env.VITE_LOCAL_USER_NAME || 'Local Dev User',
    email: import.meta.env.VITE_LOCAL_USER_EMAIL || 'dev@local',
  };
}

async function getUserFromMsal(): Promise<User | null> {
  const account = await getActiveAccount();
  if (!account) return null;
  return {
    name: account.name || account.username.split('@')[0] || 'User',
    email: account.username || '',
  };
}

export async function ensureDashboardLogin(): Promise<void> {
  if (LOCAL_AUTH_BYPASS) return;

  if (!msalEnabled) {
    throw new Error('msal_not_configured');
  }

  const user = await getUserFromMsal();
  if (user) {
    try {
      sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
      sessionStorage.removeItem(LOGIN_ATTEMPT_AT_KEY);
    } catch {}
    return;
  }

  if (await isMsalInteractionInProgress()) {
    throw new Error('msal_interaction_in_progress');
  }

  const loginAttempted = (() => {
    try {
      if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY) !== 'true') return false;
      const raw = sessionStorage.getItem(LOGIN_ATTEMPT_AT_KEY);
      const startedAt = raw ? Number(raw) : NaN;
      if (Number.isFinite(startedAt) && Date.now() - startedAt > LOGIN_ATTEMPT_STALE_MS) {
        sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
        sessionStorage.removeItem(LOGIN_ATTEMPT_AT_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  })();

  if (loginAttempted) {
    throw new Error('msal_login_pending');
  }

  await loginWithMsal();
  throw new Error('msal_login_redirect_started');
}

export async function getAccessToken(options?: { interactive?: boolean }): Promise<string | null> {
  if (LOCAL_AUTH_BYPASS) return 'local-dev-token';
  if (!msalEnabled) return null;
  return acquireAccessToken(options);
}

export async function clearMsalSession(): Promise<void> {
  if (!msalEnabled) return;
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    sessionStorage.removeItem(LOGIN_ATTEMPT_AT_KEY);
  } catch {}
}

export async function getUser(): Promise<User | null> {
  if (LOCAL_AUTH_BYPASS) return devUser();
  if (!msalEnabled) return null;
  const user = await getUserFromMsal();
  if (user) return user;
  return null;
}
