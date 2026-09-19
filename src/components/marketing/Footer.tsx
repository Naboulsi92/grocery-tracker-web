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
          <a href="/about" className="mk-footer-link" data-testid="footer-link-about">
            {t('mk.footer_about')}
          </a>
          <a href="/contact" className="mk-footer-link" data-testid="footer-link-contact">
            {t('mk.footer_contact')}
          </a>
          <a href="/terms" className="mk-footer-link" data-testid="footer-link-terms">
            {t('mk.footer_terms')}
          </a>
        </div>
      </div>
    </footer>
  );
}
