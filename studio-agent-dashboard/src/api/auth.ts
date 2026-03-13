export interface User {
  name: string;
  email: string;
}

const LOCAL_AUTH_BYPASS = import.meta.env.VITE_LOCAL_AUTH_BYPASS === 'true';

export async function getUser(): Promise<User | null> {
  if (LOCAL_AUTH_BYPASS) {
    return {
      name: import.meta.env.VITE_LOCAL_USER_NAME || 'Local Dev User',
      email: import.meta.env.VITE_LOCAL_USER_EMAIL || 'dev@local',
    };
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
