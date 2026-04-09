import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ensureDashboardLogin, getAccessToken, getUser, type User } from '../api/auth';

export type DashboardAuthStatus =
  | 'booting'
  | 'redirect_processing'
  | 'signed_out'
  | 'token_ready'
  | 'token_error';

export interface AuthState {
  user: User | null;
  loading: boolean;
  authError: string | null;
  status: DashboardAuthStatus;
  accessToken: string | null;
}

const LOGIN_ATTEMPT_KEY = 'studio_agent_msal_login_started';
const LOGIN_ATTEMPT_AT_KEY = 'studio_agent_msal_login_started_at';
const LOGIN_PENDING_TIMEOUT_MS = 15000;

const initialAuthState: AuthState = {
  user: null,
  loading: true,
  authError: null,
  status: 'booting',
  accessToken: null,
};

const AuthContext = createContext<AuthState>(initialAuthState);

function clearLoginAttempt() {
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    sessionStorage.removeItem(LOGIN_ATTEMPT_AT_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const loginPendingTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const clearPendingTimer = () => {
      if (loginPendingTimer.current !== null) {
        window.clearTimeout(loginPendingTimer.current);
        loginPendingTimer.current = null;
      }
    };

    const resolveAuth = async () => {
      try {
        await ensureDashboardLogin();
        const user = await getUser();

        if (!active) return;
        clearPendingTimer();

        if (!user) {
          setState({
            user: null,
            loading: false,
            authError: 'sign_in_required',
            status: 'signed_out',
            accessToken: null,
          });
          return;
        }

        const token = await getAccessToken({ interactive: false });

        if (!active) return;

        if (!token) {
          setState({
            user,
            loading: false,
            authError: 'token_unavailable',
            status: 'token_error',
            accessToken: null,
          });
          return;
        }

        setState({
          user,
          loading: false,
          authError: null,
          status: 'token_ready',
          accessToken: token,
        });
      } catch (error) {
        if (!active) return;

        const message = error instanceof Error ? error.message : '';

        if (message === 'msal_login_pending') {
          setState((current) => ({
            ...current,
            loading: true,
            authError: null,
            status: 'redirect_processing',
          }));
          clearPendingTimer();
          loginPendingTimer.current = window.setTimeout(() => {
            if (!active) return;
            clearLoginAttempt();
            setState({
              user: null,
              loading: false,
              authError: 'sign_in_timeout',
              status: 'signed_out',
              accessToken: null,
            });
          }, LOGIN_PENDING_TIMEOUT_MS);
          return;
        }

        if (message === 'msal_interaction_in_progress' || message === 'msal_login_redirect_started') {
          setState((current) => ({
            ...current,
            loading: true,
            authError: null,
            status: 'redirect_processing',
          }));
          return;
        }

        clearPendingTimer();
        clearLoginAttempt();
        setState({
          user: null,
          loading: false,
          authError: message || 'sign_in_failed',
          status: 'token_error',
          accessToken: null,
        });
      }
    };

    void resolveAuth();

    return () => {
      active = false;
      clearPendingTimer();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}
