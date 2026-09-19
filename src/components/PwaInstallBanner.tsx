'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useI18n } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const VISITS_KEY = 'pwa-banner-visits';
const DISMISSALS_KEY = 'pwa-banner-dismissals';
const PWA_BANNER_EVENT = 'pwa-banner-change';

function getVisits(): number {
  return Number(localStorage.getItem(VISITS_KEY) ?? 0);
}

function getDismissals(): number {
  return Number(localStorage.getItem(DISMISSALS_KEY) ?? 0);
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
    if (event.key === VISITS_KEY || event.key === DISMISSALS_KEY) {
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
  const dismissals = useSyncExternalStore(subscribePwaBanner, getDismissals, () => 0);
  const standalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, () => false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Increment the visit count once per page load (client-side only).
  useEffect(() => {
    localStorage.setItem(VISITS_KEY, String(getVisits() + 1));
    window.dispatchEvent(new Event(PWA_BANNER_EVENT));
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallEvent(null);
    }
  }, [installEvent]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSALS_KEY, String(getDismissals() + 1));
    window.dispatchEvent(new Event(PWA_BANNER_EVENT));
    setDismissed(true);
  }, []);

  // Already running as an installed PWA (standalone display mode).
  if (standalone) return null;

  // Wait for the browser's beforeinstallprompt event before offering install.
  if (!installEvent) return null;

  // Visit rule: the banner appears starting from the 2nd visit.
  // Dismissal rule: it reappears on a future visit until the user has
  // dismissed it 2 times total, after which it is hidden permanently.
  // `dismissed` additionally hides it for the remainder of the current visit.
  const show = visits >= 2 && dismissals < 2 && !dismissed;

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