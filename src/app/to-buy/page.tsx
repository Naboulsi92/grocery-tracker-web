'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import ThemeToggle from '@/components/ThemeToggle';
import { getErrorMessage, getLowStockItems, joinInventory, type InventoryItem } from '@/lib/inventory';

export default function ToBuyPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const { householdId } = useAuth();
  const [supabase] = useState(createClient);
  const requestId = useRef(0);

  const fetchItems = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [itemsRes, categoriesRes, unitsRes] = await Promise.all([
        supabase.from('items').select('*').eq('household_id', householdId).order('name'),
        supabase.from('categories').select('*').eq('household_id', householdId),
        supabase.from('units').select('*'),
      ]);
      const queryError = itemsRes.error ?? categoriesRes.error ?? unitsRes.error;
      if (queryError) throw queryError;
      if (currentRequest !== requestId.current) return;
      setItems(getLowStockItems(joinInventory(itemsRes.data ?? [], categoriesRes.data ?? [], unitsRes.data ?? [])));
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'Impossible de charger la liste d’achats.'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase]);
  const loadItems = useEffectEvent(fetchItems);

  useRealtimeTable({
    supabase,
    householdId: householdId ?? '',
    tables: ['items', 'categories'],
    loadFunction: () => void loadItems(),
  });

  useEffect(() => {
    if (!householdId) return;
    queueMicrotask(() => void loadItems(true));
  }, [householdId, loadItems]);

  async function updateQuantity(id: string, delta: number) {
    if (mutatingId) return;
    setMutatingId(id);
    setError('');
    try {
      const { data, error: quantityError } = await supabase.rpc('adjust_item_quantity', {
        p_item_id: id,
        p_delta: delta,
      });
      if (quantityError) throw quantityError;
      if (data.household_id !== householdId) throw new Error('Article hors du foyer courant.');
      setItems((current) => current
        .map((item) => item.id === id ? { ...item, ...data } : item)
        .filter((item) => item.quantity <= item.low_stock_threshold));
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'Impossible de modifier la quantité.'));
    } finally {
      setMutatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
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
            <Link href="/home" className="back-link" aria-label="Retour à l’accueil">
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
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            {error}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchItems(true)}>Réessayer</button>
          </div>
        )}
        {items.length === 0 && !error ? (
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
        ) : items.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                className="to-buy-item animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="to-buy-info">
                  <span className="to-buy-icon" aria-hidden="true">{item.category?.icon || '📦'}</span>
                  <div>
                    <span className="to-buy-name">{item.name}</span>
                    <span className="to-buy-stock">
                      {item.quantity}/{item.low_stock_threshold} {item.unit?.abbrev || ''}
                    </span>
                  </div>
                </div>
                 <button
                   onClick={() => updateQuantity(item.id, 1)}
                    className="btn btn-primary"
                    disabled={mutatingId !== null}
                   aria-label={`Ajouter une unité de ${item.name}`}
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
        ) : null}
      </main>
    </div>
  );
}
