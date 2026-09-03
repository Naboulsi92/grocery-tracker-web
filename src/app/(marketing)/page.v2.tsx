import { HeroV2 } from '@/components/marketing/Hero.v2';
import { FeaturesV2 } from '@/components/marketing/Features.v2';
import { HowItWorksV2 } from '@/components/marketing/HowItWorks.v2';
import { FAQV2 } from '@/components/marketing/FAQ.v2';
import { CTAV2 } from '@/components/marketing/CTA.v2';
import './globals.v2.css';

export default function HomePageV2() {
  return (
    <div>
      <section id="hero-v2">
        <HeroV2 />
      </section>
      <section id="features-v2">
        <FeaturesV2 />
      </section>
      <section id="how-it-works-v2">
        <HowItWorksV2 />
      </section>
      <section id="faq-v2">
        <FAQV2 />
      </section>
      <section id="cta-v2">
        <CTAV2 />
      </section>
    </div>
  );
}
