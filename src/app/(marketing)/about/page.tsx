import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Grocery List App',
  description: 'Learn more about the Grocery List App, a collaborative grocery inventory management platform for households.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>About</h1>

        <p>
          Grocery List is a collaborative grocery inventory management platform
          that helps households keep track of what they have and what they need.
          Instead of wandering through the store with a fuzzy memory, every
          member of the household can see the current stock, add items to the
          shared list, and mark items as running low right when it happens.
        </p>

        <h2>Made for the whole household</h2>
        <p>
          Every household shares a single inventory. Items, quantities, and
          categories are visible in real time to all members, so anyone can
          pick up the shopping without asking first. Quantity changes and
          threshold alerts are pushed to the rest of the household as they
          happen.
        </p>

        <h2>Simple by design</h2>
        <ul>
          <li>One household, one shared list.</li>
          <li>Secure invitations keep the list private to your household.</li>
          <li>Default categories and items let you start in minutes.</li>
          <li>Optimized for quick use on a phone in the store.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions or feedback? See the <a href="/contact">Contact</a> page
          or review our <a href="/privacy">Privacy Policy</a> and{' '}
          <a href="/terms">Terms of Use</a>.
        </p>
      </div>
    </div>
  );
}