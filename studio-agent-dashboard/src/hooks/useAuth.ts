import { useEffect, useState } from 'react';
import { getUser, type User } from '../api/auth';

const SWA_LOGIN_PATH = '/.auth/login/aad?post_login_redirect_uri=/dashboard';
const SWA_FORCE_LOGIN_PATH = '/.auth/logout?post_logout_redirect_uri=/.auth/login/aad?post_login_redirect_uri=/dashboard';
const FORCE_LOGIN_FLAG = 'studio-agent-force-login';

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

    if (!sessionStorage.getItem(FORCE_LOGIN_FLAG)) {
      sessionStorage.setItem(FORCE_LOGIN_FLAG, '1');
      window.location.assign(SWA_FORCE_LOGIN_PATH);
      return () => {
        active = false;
      };
    }

    getUser()
      .then((user) => {
        if (!active) return;
        if (!user) {
          window.location.assign(SWA_LOGIN_PATH);
          return;
        }
        sessionStorage.removeItem(FORCE_LOGIN_FLAG);
        setState({ user, loading: false });
      })
      .catch(() => {
        if (!active) return;
        window.location.assign(SWA_LOGIN_PATH);
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
