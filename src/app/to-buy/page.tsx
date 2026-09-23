'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncingIndicator } from '@/components/SyncingIndicator';
import { getErrorMessage, getLowStockItems, joinInventory, CATEGORY_COLUMNS, ITEM_COLUMNS, type InventoryItem } from '@/lib/inventory';
import { updateItemQuantity } from '@/lib/itemOperations';
import { validateQuantity } from '@/lib/validation';
import { getUnitStep } from '@/types/units';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useResyncOnReconnect } from '@/hooks/useResyncOnReconnect';
import { translateMessage } from '@/lib/i18n';

export default function ToBuyPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [thresholdNoticeId, setThresholdNoticeId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const { householdId } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { t, language } = useI18n();
  const { household, members, loading: householdLoading, error: householdError } = useHousehold(householdId ?? '');
  const isLoading = loading || householdLoading;
  const combinedError = householdError || error;
  const [supabase] = useState(createClient);
  const requestId = useRef(0);
  const checkedIdsRef = useRef<Set<string>>(new Set());

  function markChecked(id: string) {
    const next = new Set(checkedIdsRef.current).add(id);
    checkedIdsRef.current = next;
    setCheckedIds(next);
  }

  const fetchItems = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        // Ticket #117 : colonnes explicites (Row complet, pas de '*').
        // Inventaire SANS pagination (décision ticket) : tri conservé.
        supabase.from('items').select(ITEM_COLUMNS).eq('household_id', householdId).order('name'),
        supabase.from('categories').select(CATEGORY_COLUMNS).eq('household_id', householdId),
      ]);
      const queryError = itemsRes.error ?? categoriesRes.error;
      if (queryError) throw queryError;
      if (currentRequest !== requestId.current) return;
      const lowStockItems = getLowStockItems(joinInventory(itemsRes.data ?? [], categoriesRes.data ?? []));
      setItems((current) => {
        const keptChecked = current.filter((item) => checkedIdsRef.current.has(item.id));
        if (keptChecked.length === 0) return lowStockItems;
        const byId = new Map(lowStockItems.map((item) => [item.id, item]));
        keptChecked.forEach((item) => {
          if (!byId.has(item.id)) byId.set(item.id, item);
        });
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'error.load_tobuy'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase]);
  const loadItems = useEffectEvent(fetchItems);

  // Resync background silencieuse à la reconnexion (PRD §4.12 + §5).
  useResyncOnReconnect(fetchItems);

  useEffect(() => {
    if (!householdId) return;

    queueMicrotask(() => void loadItems(true));

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`tobuy:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void loadItems(), 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void loadItems(), 300);
      })
      .subscribe();

    return () => {
      requestId.current += 1;
      clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, supabase]);

  async function handleConfirmQuantity(id: string) {
    const raw = quantityInputs[id];
    if (!raw || mutatingId || !isOnline) return;
    if (validateQuantity(raw) !== null) return;
    const delta = Number(raw);
    if (delta <= 0) return;

    const currentItem = items.find((item) => item.id === id);
    if (!currentItem) return;

    setMutatingId(id);
    setError('');
    setThresholdNoticeId(null);
    setQuantityInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const { error } = await updateItemQuantity(id, delta);
      if (error) throw error;
      if (currentItem.quantity + delta > currentItem.low_stock_threshold) {
        markChecked(id);
      } else {
        setThresholdNoticeId(id);
      }
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'error.save_quantity'));
    } finally {
      setMutatingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <OfflineBanner />
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <OfflineBanner />
      <AuthenticatedHeader showBackLink household={household} loading={householdLoading} error={householdError} />
      <SyncingIndicator />

      <main className="app-main" id="main">
        <h1>{t('tobuy.title')}</h1>
        {combinedError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            {translateMessage(language, combinedError)}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchItems(true)} data-testid="btn-retry-tobuy">{t('common.retry')}</button>
          </div>
        )}
        {items.length === 0 && !error ? (
          <div className="empty-state" data-testid="tobuy-empty-state">
            <div className="success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <p>{t('tobuy.empty_title')}</p>
            <span>{t('tobuy.empty_sub')}</span>
          </div>
        ) : items.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item, index) => {
              const isChecked = checkedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`to-buy-item animate-fade-in${isChecked ? ' checked' : ''}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                  data-testid={`tobuy-item-row-${item.name.toLowerCase()}`}
                >
                  <div className="to-buy-info">
                    <span className="to-buy-icon" aria-hidden="true">📦</span>
                    <div>
                      <span className="to-buy-name">{item.name}</span>
                      <span className="to-buy-stock">
                        {item.quantity}/{item.low_stock_threshold} {item.unit}
                      </span>
                    </div>
                  </div>
                  {isChecked ? (
                    <span className="badge badge-success" aria-label={t('tobuy.in_stock_aria', { name: item.name })}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {t('tobuy.in_stock')}
                    </span>
                  ) : (
                    <div className="to-buy-controls">
                      <input
                        type="number"
                        min={1}
                        step={getUnitStep(item.unit)}
                        inputMode="numeric"
                        className="to-buy-qty-input"
                        placeholder={t('tobuy.qty_placeholder')}
                        value={quantityInputs[item.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThresholdNoticeId(null);
                          setQuantityInputs((prev) => ({ ...prev, [item.id]: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleConfirmQuantity(item.id);
                        }}
                        disabled={mutatingId !== null || !isOnline}
                        aria-label={t('tobuy.qty_aria', { name: item.name })}
                        data-testid="tobuy-quantity-input"
                      />
                      <button
                        onClick={() => void handleConfirmQuantity(item.id)}
                        className="btn btn-primary"
                        disabled={mutatingId !== null || !quantityInputs[item.id] || !isOnline}
                        aria-label={t('tobuy.confirm_aria', { name: item.name })}
                        data-testid="tobuy-check-button"
                      >
                        {mutatingId === item.id ? (
                          <span className="spinner" aria-hidden="true"></span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {t('tobuy.confirm')}
                      </button>
                    </div>
                  )}
                  {thresholdNoticeId === item.id && (
                    <p className="field-error" role="status" style={{ marginTop: '0.75rem' }} data-testid="tobuy-threshold-notice">
                      {t('tobuy.threshold_not_met')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </main>
    </div>
  );
}