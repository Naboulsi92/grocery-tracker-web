import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { getSiteUrl } from '@/lib/site-url';
import { dmSans, outfit } from './fonts';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Liste de courses",
  description: "Application de suivi de courses partagée",
};

export const viewport: Viewport = {
  themeColor: '#15803d',
  width: 'device-width',
  initialScale: 1,
};

const themeScript = `(() => {
  const stored = localStorage.getItem('theme');
  const theme = stored === 'light' || stored === 'dark'
    ? stored
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;

const langScript = `(() => {
  const stored = localStorage.getItem('language');
  if (stored === 'fr' || stored === 'en') {
    document.documentElement.lang = stored;
  }
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${dmSans.variable} ${outfit.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        {/* Skip link (WCAG 2.4.1): first focusable element on every page. */}
        <a href="#main" className="skip-link" data-testid="skip-link">
          Aller au contenu
        </a>
        <ServiceWorkerRegister />
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>{children}</LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
