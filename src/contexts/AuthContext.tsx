'use client';

import { User, Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState<ReturnType<typeof import('@/utils/supabase/client').createClient> | null>(null);

  useEffect(() => {
    import('@/utils/supabase/client').then(({ createClient }) => {
      const client = createClient();
      setSupabase(client);

      client.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = client.auth.onAuthStateChange((_event: string, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Client not initialized') };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Client not initialized') };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const defaultContextValue: AuthContextType = {
    user: null,
    session: null,
    loading: !supabase,
    signIn: async () => ({ error: new Error('Client not initialized') }),
    signUp: async () => ({ error: new Error('Client not initialized') }),
    signOut: async () => {},
  };

  return (
    <AuthContext.Provider value={supabase ? { user, session, loading, signIn, signUp, signOut } : defaultContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}