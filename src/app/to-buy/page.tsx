'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';

interface Item {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
  category_id: string | null;
  categories?: { id: string; name: string; icon: string };
  units?: { abbrev: string };
}

export default function ToBuyPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchItems();

    const channel = supabase
      .channel('to-buy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, router, supabase]);

  async function fetchItems() {
    const { data: memberData } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user?.id)
      .single();

    if (!memberData?.household_id) {
      router.push('/join-household');
      return;
    }

    const { data: allItems } = await supabase
      .from('items')
      .select('*, categories(id, name, icon), units(abbrev)')
      .eq('household_id', memberData.household_id);

    const lowStockItems = (allItems || []).filter(item => item.quantity <= item.low_stock_threshold);

    setItems(lowStockItems);
    setLoading(false);
  }

  async function updateQuantity(id: string, delta: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + delta);
    await supabase.from('items').update({ quantity: newQuantity }).eq('id', id);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/home" className="text-gray-600 hover:text-gray-900">
              ← Retour
            </Link>
            <h1 className="text-xl font-bold text-gray-900">A acheter</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">✅</div>
            <p>Tout est en stock !</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow p-4 flex items-center justify-between border-l-4 border-red-500"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.categories?.icon || '📦'}</span>
                  <div>
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      ({item.quantity}/{item.low_stock_threshold} {item.units?.abbrev || ''})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    + Ajouter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}