'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useI18n } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const VISITS_KEY = 'pwa-banner-visits';
// Visit count at the last dismissal — the banner snoozes until 2 further
// visits (PRD §4.13). Legacy key 'pwa-banner-dismissals' (dismissal counter
// with permanent hide) is intentionally ignored: clients carrying it simply
// become re-eligible, which matches the no-permanent-hide rule.
const SNOOZED_AT_KEY = 'pwa-banner-snoozed-at';
const INSTALLED_KEY = 'pwa-banner-installed';
const PWA_BANNER_EVENT = 'pwa-banner-change';

function readVisitCounter(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getVisits(): number {
  return readVisitCounter(VISITS_KEY) ?? 0;
}

function getSnoozedAt(): number | null {
  return readVisitCounter(SNOOZED_AT_KEY);
}

function persistAndBroadcast(key: string, value: string): void {
  localStorage.setItem(key, value);
  window.dispatchEvent(new Event(PWA_BANNER_EVENT));
}

function isInstalled(): boolean {
  return localStorage.getItem(INSTALLED_KEY) === '1';
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function subscribeStandalone(onStoreChange: () => void): () => void {
  const mql = window.matchMedia('(display-mode: standalone)');
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function subscribePwaBanner(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === VISITS_KEY || event.key === SNOOZED_AT_KEY || event.key === INSTALLED_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener(PWA_BANNER_EVENT, onStoreChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(PWA_BANNER_EVENT, onStoreChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export function PwaInstallBanner() {
  const { t } = useI18n();
  const visits = useSyncExternalStore(subscribePwaBanner, getVisits, () => 0);
  const snoozedAt = useSyncExternalStore(subscribePwaBanner, getSnoozedAt, () => null);
  const installed = useSyncExternalStore(subscribePwaBanner, isInstalled, () => false);
  const standalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, () => false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Increment the visit count once per page load (client-side only).
  // Note: React StrictMode remounts once in development (`next dev`, which
  // E2E uses), so a dev load counts 2 visits; production counts exactly 1.
  // Visit-arithmetic assertions live in unit tests (single mount each);
  // E2E reads the counters instead of assuming increments.
  useEffect(() => {
    persistAndBroadcast(VISITS_KEY, String(getVisits() + 1));
  }, []);

  const markInstalled = useCallback(() => {
    persistAndBroadcast(INSTALLED_KEY, '1');
    setInstallEvent(null);
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      markInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [markInstalled]);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === 'accepted') {
        markInstalled();
      }
    } catch {
      // Native prompt unavailable or rejected (e.g. already showing):
      // keep the banner so the user can retry or dismiss.
      console.warn('client_operation_failed', { area: 'pwa', action: 'install', code: 'prompt_failed' });
    }
  }, [installEvent, markInstalled]);

  const handleDismiss = useCallback(() => {
    persistAndBroadcast(SNOOZED_AT_KEY, String(getVisits()));
    setDismissed(true);
  }, []);

  // Already installed (persisted flag) or running as an installed PWA.
  if (installed || standalone) return null;

  // Wait for the browser's beforeinstallprompt event before offering install.
  if (!installEvent) return null;

  // Visit rule (PRD §4.13) : the banner appears starting from the 2nd visit.
  // Dismissal rule : a dismissal snoozes it until 2 further visits
  // (visits >= snoozedAt + 2) — no permanent hide. `dismissed` additionally
  // hides it for the remainder of the current visit.
  const snoozed = snoozedAt !== null && visits < snoozedAt + 2;
  const show = visits >= 2 && !snoozed && !dismissed;

  if (!show) return null;

  return (
    <div
      role="status"
      aria-label={t('pwa.banner_aria')}
      data-testid="pwa-install-banner"
      className="pwa-install-banner"
    >
      <p className="pwa-install-text">
        {t('pwa.text')}
      </p>
      <div className="pwa-install-actions">
        <button
          type="button"
          data-testid="pwa-install-button"
          aria-label={t('pwa.install_aria')}
          onClick={handleInstall}
          className="btn btn-primary pwa-install-button"
        >
          {t('pwa.install')}
        </button>
        <span data-testid="pwa-dismiss-button">
          <button
            type="button"
            data-testid="pwa-install-dismiss"
            aria-label={t('pwa.later_aria')}
            onClick={handleDismiss}
            className="btn btn-secondary pwa-install-button"
          >
            {t('pwa.later')}
          </button>
        </span>
      </div>
    </div>
  );
}