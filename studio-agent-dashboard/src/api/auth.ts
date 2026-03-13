export interface User {
  name: string;
  email: string;
}

export async function getUser(): Promise<User | null> {
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
