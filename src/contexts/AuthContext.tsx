import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabaseClient } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// Если VITE_ADMIN_EMAIL не задан, клиентская проверка пропускается — доступ ограничивает сервер (ADMIN_EMAIL).
const ALLOWED_ADMIN_EMAIL = (
  import.meta.env.DEV
    ? import.meta.env.VITE_DEV_ADMIN_EMAIL || ''
    : import.meta.env.VITE_ADMIN_EMAIL || ''
).trim().toLowerCase();
export const EXPLICIT_DEV_AUTH_BYPASS = !import.meta.env.PROD
  && import.meta.env.VITE_ALLOW_DEV_AUTH_BYPASS === 'true';

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    // Get initial session
    void supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      sessionRef.current = session;
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to restore Supabase session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        sessionRef.current = session;
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const isApiRequest = typeof input === 'string' && input.startsWith('/api/');
      const token = sessionRef.current?.access_token;

      if (!isApiRequest || !token) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init?.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      if (ALLOWED_ADMIN_EMAIL && email.trim().toLowerCase() !== ALLOWED_ADMIN_EMAIL) {
        return { error: 'Доступ разрешён только владельцу админки' };
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        if (EXPLICIT_DEV_AUTH_BYPASS && (!ALLOWED_ADMIN_EMAIL || email.trim().toLowerCase() === ALLOWED_ADMIN_EMAIL)) {
          const mockUser = { id: 'mock-user-id', email } as any;
          setUser(mockUser);
          setSession({ user: mockUser } as any);
          sessionRef.current = { user: mockUser } as any;
          return { error: null };
        }
        return { error: error.message };
      }
      if (data.session) {
        setSession(data.session);
        sessionRef.current = data.session;
        setUser(data.session.user);
      }
      return { error: null };
    } catch (e: any) {
      if (EXPLICIT_DEV_AUTH_BYPASS && (!ALLOWED_ADMIN_EMAIL || email.trim().toLowerCase() === ALLOWED_ADMIN_EMAIL)) {
        const mockUser = { id: 'mock-user-id', email } as any;
        setUser(mockUser);
        setSession({ user: mockUser } as any);
        sessionRef.current = { user: mockUser } as any;
        return { error: null };
      }
      return { error: e?.message || 'Ошибка авторизации' };
    }
  };

  const signUp = async (email: string, password: string) => {
    return { error: 'Регистрация закрыта' };
  };

  const signOut = async () => {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {}
    setUser(null);
    setSession(null);
    sessionRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
