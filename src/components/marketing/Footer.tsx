'use client';

import { useI18n } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mk-footer">
      <div className="mk-container mk-footer-inner">
        <p>
          &copy; {new Date().getFullYear()} Grocery Tracker. {t('mk.footer_rights')}
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
          <a href="/privacy" className="mk-footer-link" data-testid="footer-link-privacy">
            {t('mk.footer_privacy')}
          </a>
        </div>
      </div>
    </footer>
  );
}
