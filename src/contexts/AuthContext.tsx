'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';

export type PrivateAccess =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'no-household'; user: User }
  | { status: 'error'; user: User | null; error: Error }
  | { status: 'member'; user: User; householdId: string };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  access: PrivateAccess;
  householdId: string | null;
  retryHousehold: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(createClient);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<PrivateAccess>({ status: 'loading' });
  const [householdRequest, setHouseholdRequest] = useState(0);
  const resolutionId = useRef(0);

  const resolveSession = useEffectEvent(async (nextSession: Session | null, isActive: () => boolean) => {
    const currentResolution = ++resolutionId.current;
    const nextUser = nextSession?.user ?? null;
    setSession(nextSession);
    setUser(nextUser);

    if (!nextUser) {
      setAccess({ status: 'anonymous' });
      return;
    }

    setAccess({ status: 'loading' });
    const { data, error } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', nextUser.id)
      .maybeSingle();

    if (!isActive() || currentResolution !== resolutionId.current) return;
    if (error) {
      setAccess({ status: 'error', user: nextUser, error });
    } else if (!data?.household_id) {
      setAccess({ status: 'no-household', user: nextUser });
    } else {
      setAccess({ status: 'member', user: nextUser, householdId: data.household_id });
    }
  });

  useEffect(() => {
    let active = true;
    const initialSessionRequest = ++resolutionId.current;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || initialSessionRequest !== resolutionId.current) return;
      if (error) {
        setAccess({ status: 'error', user: null, error });
        return;
      }
      void resolveSession(data.session, () => active);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveSession(nextSession, () => active);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, householdRequest]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading: access.status === 'loading',
      access,
      householdId: access.status === 'member' ? access.householdId : null,
      retryHousehold: () => setHouseholdRequest((request) => request + 1),
      signIn,
      signUp,
      signOut,
    }}>
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
