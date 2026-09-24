'use client';

import Link from 'next/link';
import { useI18n } from '@/contexts/LanguageContext';

/** Unknown routes: translated 404 with a home link (ticket #122). */
export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="page-container">
      <main id="main" className="app-main">
        <div className="empty-state">
          <h1>{t('notfound.title')}</h1>
          <p className="text-muted">{t('notfound.message')}</p>
          <Link href="/" className="btn btn-primary">
            {t('auth.back_home')}
          </Link>
        </div>
      </main>
    </div>
  );
}
