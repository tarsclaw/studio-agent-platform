import { useEffect, useState } from 'react';
import { getUser, type User } from '../api/auth';

const SWA_LOGIN_PATH = '/.auth/login/aad?post_login_redirect_uri=/dashboard';

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

    getUser()
      .then((user) => {
        if (!active) return;
        if (!user) {
          window.location.assign(SWA_LOGIN_PATH);
          return;
        }
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
