import { acquireAccessToken, getActiveAccount, isMsalInteractionInProgress, loginWithMsal, msalEnabled } from '../msalConfig';

export interface User {
  name: string;
  email: string;
}

const LOCAL_AUTH_BYPASS = import.meta.env.VITE_LOCAL_AUTH_BYPASS === 'true';
const LOGIN_ATTEMPT_KEY = 'studio_agent_msal_login_started';

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
  if (msalEnabled) {
    const user = await getUserFromMsal();
    if (user) {
      try {
        sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
      } catch {}
      return;
    }

    if (await isMsalInteractionInProgress()) {
      throw new Error('msal_interaction_in_progress');
    }

    const loginAttempted = (() => {
      try {
        return sessionStorage.getItem(LOGIN_ATTEMPT_KEY) === 'true';
      } catch {
        return false;
      }
    })();

    if (loginAttempted) {
      throw new Error('msal_login_pending');
    }

    try {
      sessionStorage.setItem(LOGIN_ATTEMPT_KEY, 'true');
    } catch {}

    await loginWithMsal();
    throw new Error('msal_login_redirect_started');
  }

  const user = await getUser();
  if (!user) {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/dashboard';
    throw new Error('swa_login_redirect_started');
  }
}

export async function getAccessToken(options?: { interactive?: boolean }): Promise<string | null> {
  if (LOCAL_AUTH_BYPASS) return 'local-dev-token';

  if (msalEnabled) {
    return acquireAccessToken(options);
  }

  return null;
}

export async function clearMsalSession(): Promise<void> {
  if (!msalEnabled) return;
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
  } catch {}
}

export async function getUser(): Promise<User | null> {
  if (LOCAL_AUTH_BYPASS) return devUser();

  if (msalEnabled) {
    const user = await getUserFromMsal();
    if (user) return user;
    return null;
  }

  try {
    const res = await fetch('/.auth/me');
    const data = await res.json();
    const principal = data.clientPrincipal;
    if (!principal) return null;

    return {
      name: principal.userDetails?.split('@')[0] || 'User',
      email: principal.userDetails || '',
    };
  } catch {
    return null;
  }
}
