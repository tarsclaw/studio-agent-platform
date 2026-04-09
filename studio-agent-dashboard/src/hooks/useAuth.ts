import { useEffect, useRef, useState } from 'react';
import { ensureDashboardLogin, getUser, type User } from '../api/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
}

const LOGIN_ATTEMPT_KEY = 'studio_agent_msal_login_started';
const LOGIN_PENDING_TIMEOUT_MS = 15000;

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });
  const loginPendingTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const clearPendingTimer = () => {
      if (loginPendingTimer.current !== null) {
        window.clearTimeout(loginPendingTimer.current);
        loginPendingTimer.current = null;
      }
    };

    const clearLoginAttempt = () => {
      try {
        sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
      } catch {}
    };

    ensureDashboardLogin()
      .then(() => getUser())
      .then((user) => {
        if (!active) return;
        clearPendingTimer();
        setState({ user, loading: false });
      })
      .catch((error) => {
        if (!active) return;

        const message = error instanceof Error ? error.message : '';

        if (message === 'msal_login_pending') {
          setState((current) => ({ ...current, loading: true }));
          clearPendingTimer();
          loginPendingTimer.current = window.setTimeout(() => {
            if (!active) return;
            clearLoginAttempt();
            setState({ user: null, loading: false });
          }, LOGIN_PENDING_TIMEOUT_MS);
          return;
        }

        const authStillLoading =
          message === 'msal_interaction_in_progress' ||
          message === 'msal_login_redirect_started';

        if (authStillLoading) {
          setState((current) => ({ ...current, loading: true }));
          return;
        }

        clearPendingTimer();
        clearLoginAttempt();
        setState({ user: null, loading: false });
      });

    return () => {
      active = false;
      clearPendingTimer();
    };
  }, []);

  return state;
}
