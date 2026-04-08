import { acquireAccessToken, getActiveAccount, getMsalApp, msalEnabled } from '../msalConfig';

export interface User {
  name: string;
  email: string;
}

const LOCAL_AUTH_BYPASS = import.meta.env.VITE_LOCAL_AUTH_BYPASS === 'true';

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
  const user = await getUser();
  if (!user) {
    throw new Error('dashboard_login_required');
  }
}

export async function getAccessToken(options?: { interactive?: boolean }): Promise<string | null> {
  if (LOCAL_AUTH_BYPASS) return null;
  if (!msalEnabled) return null;
  const user = await getUser();
  if (!user) return null;
  return acquireAccessToken({ ...options, interactive: false });
}

export async function clearMsalSession(): Promise<void> {
  if (!msalEnabled) return;
  const msal = await getMsalApp();
  const account = await getActiveAccount();
  if (msal && account) {
    await msal.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin });
  }
}

export async function getUser(): Promise<User | null> {
  if (LOCAL_AUTH_BYPASS) return devUser();

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
