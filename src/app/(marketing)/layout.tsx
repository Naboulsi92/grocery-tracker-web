import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import Script from 'next/script';
import { ScrollTracker } from '@/components/marketing/ScrollTracker';
import { PageViewTracker } from '@/components/marketing/PageViewTracker';
import { getSiteUrl, getSiteHostname } from '@/lib/site-url';
import './marketing.css';

const siteUrl = getSiteUrl();
const siteHostname = getSiteHostname();

export const metadata = {
  title: 'Grocery List App - Collaborative Shopping for Households',
  description: "Never forget what to buy again. Share grocery lists, manage quantities, and coordinate shopping with your household in real-time.",
  openGraph: {
    title: 'Grocery List App - Collaborative Shopping for Households',
    description: "Never forget what to buy again. Share grocery lists, manage quantities, and coordinate shopping with your household in real-time.",
    type: 'website',
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Grocery List App',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grocery List App - Collaborative Shopping for Households',
    description: "Never forget what to buy again. Share grocery lists, manage quantities, and coordinate shopping with your household in real-time.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/',
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Grocery List App',
  url: siteUrl,
  description: "Collaborative shopping platform for households to share grocery lists and coordinate shopping in real-time.",
  logo: `${siteUrl}/logo.png`,
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Script
        defer
        data-domain={siteHostname}
        src="https://plausible.io/js/script.js"
        strategy="lazyOnload"
      />
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <Header />
      <main className="flex-1">
        {children}
        <ScrollTracker />
        <PageViewTracker />
      </main>
      <Footer />
    </div>
  );
}
