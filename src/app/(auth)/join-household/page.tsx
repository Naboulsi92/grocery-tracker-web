'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';

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
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    async function checkHousehold() {
      if (!user) return;
      
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Rejoindre ou créer un foyer</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Créer un nouveau foyer</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="Nom du foyer (optionnel)"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Créer mon foyer
              </button>
            </form>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Rejoindre un foyer existant</h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                placeholder="Code du foyer"
                value={householdCode}
                onChange={(e) => setHouseholdCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Rejoindre le foyer
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}