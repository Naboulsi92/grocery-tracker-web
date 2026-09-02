'use client';

import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import Script from 'next/script';
import { useEffect } from 'react';

export const metadata = {
  title: 'Grocery List App - Collaborative Shopping for Households',
  description: "Never forget what to buy again. Share grocery lists, manage quantities, and coordinate shopping with your household in real-time.",
  openGraph: {
    title: 'Grocery List App - Collaborative Shopping for Households',
    description: "Never forget what to buy again. Share grocery lists, manage quantities, and coordinate shopping with your household in real-time.",
    type: 'website',
    url: 'https://grocerylist.app',
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
    canonical: 'https://grocerylist.app',
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Grocery List App',
  url: 'https://grocerylist.app',
  description: "Collaborative shopping platform for households to share grocery lists and coordinate shopping in real-time.",
  logo: 'https://grocerylist.app/logo.png',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleScrollTracking = () => {
      const scrollDepth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      
      if ((window as any).plausible && [25, 50, 75, 100].includes(scrollDepth)) {
        (window as any).plausible('ScrollDepth', { props: { depth: scrollDepth } });
      }
    };

    window.addEventListener('scroll', handleScrollTracking);
    return () => window.removeEventListener('scroll', handleScrollTracking);
  }, []);

  const handleCTAClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const target = e.currentTarget;
    const ctaName = target.getAttribute('data-cta-name') || target.textContent || 'CTA';
    
    if ((window as any).plausible) {
      (window as any).plausible('CTAClick', { 
        props: { 
          name: ctaName,
          element: target.tagName,
          href: target.getAttribute('href') || target.getAttribute('data-href') || 'N/A'
        } 
      });
    }
  };

  const handleScrollTracking = () => {
    const scrollDepth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    
    if ((window as any).plausible && [25, 50, 75, 100].includes(scrollDepth)) {
      (window as any).plausible('ScrollDepth', { props: { depth: scrollDepth } });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Script
        defer
        data-domain="grocerylist.app"
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
      </main>
      <Footer />
    </div>
  );
}
