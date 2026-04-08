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

export async function ensureDashboardLogin(): Promise<void> {
  if (LOCAL_AUTH_BYPASS) return;
  const user = await getUser();
  if (!user) {
    throw new Error('dashboard_login_required');
  }
}

export async function getAccessToken(_options?: { interactive?: boolean }): Promise<string | null> {
  return null;
}

export async function clearMsalSession(): Promise<void> {
  return;
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
