'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

interface Household {
  id: string;
  name: string;
}

interface Member {
  user_id: string;
  email: string;
  joined_at: string;
}

export default function MembersPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchData() {
      if (!supabase || !user) return;

      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError || !memberData?.household_id) {
        setLoading(false);
        return;
      }

      const { data: householdData } = await supabase
        .from('households')
        .select('id, name')
        .eq('id', memberData.household_id)
        .maybeSingle();

      if (householdData) {
        setHousehold(householdData as Household);
      }

      const { data: membersData } = await supabase
        .from('household_members')
        .select('user_id, joined_at')
        .eq('household_id', memberData.household_id);

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map((m: { user_id: string }) => m.user_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);

        const mergedMembers: Member[] = membersData.map((m: { user_id: string; joined_at: string }) => {
          const userInfo = usersData?.find((u: { id: string }) => u.id === m.user_id);
          return {
            user_id: m.user_id,
            email: userInfo?.email || 'Email non disponible',
            joined_at: m.joined_at,
          };
        });
        setMembers(mergedMembers);
      }

      setLoading(false);
    }

    fetchData();
  }, [user, router, supabase, authLoading]);

  const copyToClipboard = async () => {
    if (!household) return;
    const code = household.id.slice(0, 8);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!household) {
    router.push('/join-household');
    return null;
  }

  const inviteCode = household.id.slice(0, 8);

  return (
    <div className="page-container">
      <ThemeToggle />
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <Link href="/home" className="back-link">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </Link>
            <h1>Membres</h1>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Code d&apos;invitation</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Partagez ce code avec les membres que vous souhaitez inviter dans votre foyer.
          </p>
          <div className="invite-code-display">
            <code className="invite-code-text">{inviteCode}</code>
            <button onClick={copyToClipboard} className="btn btn-secondary">
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Copié !
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copier
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Membres du foyer ({members.length})</h2>
          <div className="members-list">
            {members.map((member, index) => (
              <div
                key={member.user_id}
                className="member-item animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="member-avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="member-info">
                  <span className="member-email">{member.email}</span>
                  <span className="member-joined">
                    Membre depuis le {new Date(member.joined_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {member.user_id === user?.id && (
                  <span className="member-badge">Vous</span>
                )}
              </div>
            ))}
          </div>

          {members.length === 0 && (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p>Aucun membre</p>
              <span>Invitez des membres avec le code</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}