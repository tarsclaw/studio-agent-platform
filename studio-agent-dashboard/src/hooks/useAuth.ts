import { useEffect, useState } from 'react';
import { ensureDashboardLogin, getUser, type User } from '../api/auth';

interface AuthState {
  user: User;
  loading: boolean;
}

const devUser: User = { name: 'Dev User', email: 'dev@local' };

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: devUser,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    ensureDashboardLogin()
      .then(() => getUser())
      .then((user) => {
        if (!active) return;
        setState({ user: user ?? devUser, loading: false });
      })
      .catch(() => {
        if (!active) return;
        setState({ user: devUser, loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
