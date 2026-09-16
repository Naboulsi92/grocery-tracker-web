'use client';

import { useI18n } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mk-footer">
      <div className="mk-container mk-footer-inner">
        <p>
          &copy; {new Date().getFullYear()} Grocery List. {t('mk.footer_rights')}
        </p>
        <div className="mk-footer-links">
          {/* TODO: Create /about, /contact, /terms pages and update links */}
          <a href="#" className="mk-footer-link">
            {t('mk.footer_about')}
          </a>
          <a href="#" className="mk-footer-link">
            {t('mk.footer_contact')}
          </a>
          <a href="#" className="mk-footer-link">
            {t('mk.footer_terms')}
          </a>
        </div>
      </div>
    </footer>
  );
}
