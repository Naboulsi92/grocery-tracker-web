import { Hero } from '@/components/marketing/Hero.v3';
import { Features } from '@/components/marketing/Features.v3';
import { HowItWorks } from '@/components/marketing/HowItWorks.v3';
import { FAQ } from '@/components/marketing/FAQ.v3';
import { CTA } from '@/components/marketing/CTA.v3';
import '@/app/globals.v3.css';

export default function HomePageV3() {
  return (
    <div className="v3-body-font">
      <style jsx global>{`
        * {
          font-family: 'Open Sans', sans-serif;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto">
        <section id="hero">
          <Hero />
        </section>
        <section id="features">
          <Features />
        </section>
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <section id="faq">
          <FAQ />
        </section>
        <CTA />
      </div>
    </div>
  );
}
