import { useEffect, useState } from 'react';
import { ensureDashboardLogin, getUser, type User } from '../api/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    ensureDashboardLogin()
      .then(() => getUser())
      .then((user) => {
        if (!active) return;
        setState({ user, loading: false });
      })
      .catch(() => {
        if (!active) return;
        setState({ user: null, loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
