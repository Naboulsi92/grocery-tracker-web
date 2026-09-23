'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useResyncOnReconnect } from '@/hooks/useResyncOnReconnect';
import { getErrorMessage } from '@/lib/inventory';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { fetchHouseholdHistory, formatRelativeTime, type HistoryEntry } from '@/lib/history';
import { translateMessage } from '@/lib/i18n';

const ACTION_LABELS: Record<HistoryEntry['action_type'], string> = {
  modification: 'history.action_modification',
  suppression: 'history.action_suppression',
};

const ACTION_BADGE_CLASSES: Record<HistoryEntry['action_type'], string> = {
  modification: 'badge-success',
  suppression: 'badge-danger',
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { householdId } = useAuth();
  const { t, language } = useI18n();
  const { household, loading: householdLoading, error: householdError } = useHousehold(householdId ?? '');
  const isLoading = loading || householdLoading;
  const combinedError = householdError || error;
  const [supabase] = useState(createClient);
  const requestId = useRef(0);

  const fetchHistory = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const historyEntries = await fetchHouseholdHistory(householdId, supabase, language);
      if (currentRequest !== requestId.current) return;
      setEntries(historyEntries);
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'error.load_history'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase, language]);
  const loadHistory = useEffectEvent(fetchHistory);

  // Resync background silencieuse à la reconnexion (PRD §4.12 + §5).
  useResyncOnReconnect(fetchHistory);

  useEffect(() => {
    if (!householdId) return;

    queueMicrotask(() => void loadHistory(true));

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`history:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void loadHistory(), 300);
      })
      .subscribe();

    return () => {
      requestId.current += 1;
      clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, supabase]);

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

      <main className="app-main" id="main">
        <h1>{t('history.title')}</h1>

        {combinedError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {translateMessage(language, combinedError)}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchHistory(true)} data-testid="btn-retry-history">{t('common.retry')}</button>
          </div>
        )}

        {entries.length === 0 && !error && (
          <div className="empty-state" data-testid="history-empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <p>{t('history.empty_title')}</p>
            <span>{t('history.empty_sub')}</span>
          </div>
        )}

        {entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="item-row animate-fade-in"
                style={{ animationDelay: `${index * 20}ms` }}
                data-testid={`history-entry-${index}`}
              >
                <div className="item-info">
                  <span className={`badge ${ACTION_BADGE_CLASSES[entry.action_type]}`}>
                    {t(ACTION_LABELS[entry.action_type])}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="item-name">{entry.item_name}</span>
                    <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {t('history.by', { name: entry.actorName })}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {formatRelativeTime(entry.performed_at, language)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}