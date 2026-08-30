'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface Household {
  id: string;
  name: string;
}

export default function HomePage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { permission, requestPermission, isSupported } = usePushNotifications(user?.id || null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchHousehold() {
      if (!user) return;
      
      const { data: memberData } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (!memberData?.household_id) {
        setLoading(false);
        return;
      }

      const { data: householdData } = await supabase
        .from('households')
        .select('id, name')
        .eq('id', memberData.household_id)
        .single();

      if (householdData) {
        setHousehold(householdData as Household);
      }
      setLoading(false);
    }

    fetchHousehold();
  }, [user, router, supabase]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!household) {
    router.push('/join-household');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">{household.name}</h1>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Deconnexion
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/categories"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="text-4xl mb-2">📁</div>
            <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
            <p className="text-gray-600 text-sm">Gerer les categories de courses</p>
          </Link>

          <Link
            href="/items"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="text-4xl mb-2">🛒</div>
            <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
            <p className="text-gray-600 text-sm">Voir et modifier les articles</p>
          </Link>

          <Link
            href="/to-buy"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="text-4xl mb-2">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900">A acheter</h2>
            <p className="text-gray-600 text-sm">Articles en rupture de stock</p>
          </Link>

          <div className="block p-6 bg-white rounded-lg shadow">
            <div className="text-4xl mb-2">👥</div>
            <h2 className="text-lg font-semibold text-gray-900">Membres</h2>
            <p className="text-gray-600 text-sm">Inviter des membres</p>
            <p className="text-xs text-gray-400 mt-2">Code: {household.id.slice(0, 8)}</p>
          </div>

          {isSupported && (
            <div className="block p-6 bg-white rounded-lg shadow">
              <div className="text-4xl mb-2">🔔</div>
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <p className="text-gray-600 text-sm">
                {permission === 'granted' 
                  ? 'Notifications activées' 
                  : permission === 'denied' 
                    ? 'Notifications bloquées'
                    : 'Activer les notifications'}
              </p>
              {permission !== 'granted' && permission !== 'denied' && (
                <button
                  onClick={requestPermission}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Activer
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}