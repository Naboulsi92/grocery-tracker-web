'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

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
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
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
    if (!supabase || !user) return;

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

    const lowStockItems = (allItems || []).filter((item: Item) => item.quantity <= item.low_stock_threshold);

    setItems(lowStockItems);
    setLoading(false);
  }

  async function updateQuantity(id: string, delta: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + delta);
    await supabase.from('items').update({ quantity: newQuantity }).eq('id', id);
    fetchItems();
  }

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
            <h1>À acheter</h1>
          </div>
        </div>
      </header>

      <main className="app-main">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <p>Tout est en stock !</p>
            <span>Rien à acheter pour le moment</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                className="to-buy-item animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="to-buy-info">
                  <span className="to-buy-icon">{item.categories?.icon || '📦'}</span>
                  <div>
                    <span className="to-buy-name">{item.name}</span>
                    <span className="to-buy-stock">
                      {item.quantity}/{item.low_stock_threshold} {item.units?.abbrev || ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="btn btn-primary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Ajouter
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}