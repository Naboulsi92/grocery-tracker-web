import { Hero } from '@/components/marketing/Hero';
import { Features } from '@/components/marketing/Features';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { FAQ } from '@/components/marketing/FAQ';
import { CTA } from '@/components/marketing/CTA';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { SignedInRedirect } from '@/components/marketing/SignedInRedirect';

export default function HomePage() {
  return (
    <>
      <SignedInRedirect />
      <section id="hero">
        <Hero />
      </section>
      <Features />
      <HowItWorks />
      <FAQ />
      <CTA />
      <PwaInstallBanner />
    </>
  );
}
