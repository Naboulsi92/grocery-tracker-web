import { Hero } from '@/components/marketing/Hero.v1';
import { Features } from '@/components/marketing/Features.v1';
import { HowItWorks } from '@/components/marketing/HowItWorks.v1';
import { FAQ } from '@/components/marketing/FAQ.v1';
import { CTA } from '@/components/marketing/CTA.v1';
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import '@/app/globals.v1.css';

export default function HomePageV1() {
  return (
    <div className="min-h-screen" style={{ 
      background: 'var(--v1-color-bg)',
      fontFamily: 'var(--v1-font-body)'
    }}>
      <Header />
      <main>
        <section id="hero-v1">
          <Hero />
        </section>
        <section id="features-v1">
          <Features />
        </section>
        <section id="how-it-works-v1">
          <HowItWorks />
        </section>
        <section id="faq-v1">
          <FAQ />
        </section>
        <section id="cta-v1">
          <CTA />
        </section>
      </main>
      <Footer />
    </div>
  );
}
