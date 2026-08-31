'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

interface Household {
  id: string;
  name: string;
}

export default function JoinHouseholdPage() {
  const [householdCode, setHouseholdCode] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userHousehold, setUserHousehold] = useState<Household | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      return;
    }

    async function checkHousehold() {
      if (!user || !supabase) return;
      
      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (data?.household_id) {
        router.push('/home');
      }
    }

    checkHousehold();
  }, [user, router, supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) return;

    const { data: household, error: createError } = await supabase
      .from('households')
      .insert({ name: householdName || 'Mon Foyer' })
      .select()
      .single();

    if (createError) {
      setError(createError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: household.id, user_id: user.id });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    router.push('/home');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) return;

    const { data: household, error: findError } = await supabase
      .from('households')
      .select('id')
      .eq('id', householdCode)
      .single();

    if (findError || !household) {
      setError('Code de foyer invalide');
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: household.id, user_id: user.id });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    router.push('/home');
  };

  return (
    <div className="auth-container">
      <ThemeToggle />
      <div className="auth-card animate-fade-in">
        <div className="auth-header">
          <div className="auth-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1>Bienvenue !</h1>
          <p className="text-muted">Créez ou rejoignez un foyer</p>
        </div>
        
        {error && (
          <div className="auth-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>Créer un nouveau foyer</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Nom du foyer (optionnel)"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ background: 'var(--color-accent)' }}
              >
                {loading ? 'Création...' : 'Créer mon foyer'}
              </button>
            </form>
          </div>

          <div className="divider">
            <span>ou</span>
          </div>

          <div>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>Rejoindre un foyer existant</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Code du foyer"
                value={householdCode}
                onChange={(e) => setHouseholdCode(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Connexion...' : 'Rejoindre le foyer'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}