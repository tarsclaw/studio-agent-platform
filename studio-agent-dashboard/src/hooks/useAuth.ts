import { useEffect, useRef, useState } from 'react';
import { ensureDashboardLogin, getUser, type User } from '../api/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  authError: string | null;
}

const LOGIN_ATTEMPT_KEY = 'studio_agent_msal_login_started';
const LOGIN_PENDING_TIMEOUT_MS = 15000;

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    authError: null,
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

        if (!user) {
          setState({ user: null, loading: false, authError: 'sign_in_required' });
          return;
        }

        setState({ user, loading: false, authError: null });
      })
      .catch((error) => {
        if (!active) return;

        const message = error instanceof Error ? error.message : '';

        if (message === 'msal_login_pending') {
          setState((current) => ({ ...current, loading: true, authError: null }));
          clearPendingTimer();
          loginPendingTimer.current = window.setTimeout(() => {
            if (!active) return;
            clearLoginAttempt();
            setState({ user: null, loading: false, authError: 'sign_in_timeout' });
          }, LOGIN_PENDING_TIMEOUT_MS);
          return;
        }

        const authStillLoading =
          message === 'msal_interaction_in_progress' ||
          message === 'msal_login_redirect_started';

        if (authStillLoading) {
          setState((current) => ({ ...current, loading: true, authError: null }));
          return;
        }

        clearPendingTimer();
        clearLoginAttempt();
        setState({ user: null, loading: false, authError: message || 'sign_in_failed' });
      });

    return () => {
      active = false;
      clearPendingTimer();
    };
  }, []);

  return state;
}
