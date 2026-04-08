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
      .catch((error) => {
        if (!active) return;

        const message = error instanceof Error ? error.message : '';
        const authStillLoading =
          message === 'msal_interaction_in_progress' ||
          message === 'msal_login_pending' ||
          message === 'msal_login_redirect_started' ||
          message === 'swa_login_redirect_started';

        if (authStillLoading) {
          setState((current) => ({ ...current, loading: true }));
          return;
        }

        setState({ user: null, loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
