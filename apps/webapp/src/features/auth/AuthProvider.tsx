import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Spin } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@cdp/contracts';
import { AUTH_REQUIRED_EVENT, ApiError } from '../../lib/api';
import { getCurrentUser, logout as logoutRequest } from '../../lib/auth';
import { LoginPage } from './LoginPage';

type AuthContextValue = { user: AuthUser; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    getCurrentUser().then(current => {
      if (active) setUser(current);
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) setUser(null);
      else setError(cause instanceof Error ? cause.message : '无法确认登录状态');
    });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const requireLogin = () => {
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, requireLogin);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, requireLogin);
  }, [queryClient]);

  if (error) return <main className="auth-state"><Alert type="error" showIcon message="无法连接认证服务" description={error} action={<Button onClick={() => { setError(''); setAttempt(value => value + 1); }}>重试</Button>} /></main>;
  if (user === undefined) return <main className="auth-state" aria-label="正在确认登录状态"><Spin size="large" /></main>;
  if (!user) return <LoginPage onAuthenticated={setUser} />;

  const logout = async () => {
    await logoutRequest();
    queryClient.clear();
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return value;
}
