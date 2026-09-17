import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact - Grocery List App',
  description: 'Get in touch with the Grocery List App team for questions, feedback, or support.',
  alternates: {
    canonical: 'https://grocerylist.app/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>Contact</h1>

        <p>
          We are happy to hear from you. For questions, feedback, or support,
          reach out to the appropriate address below.
        </p>

        <h2>Support and general questions</h2>
        <p>
          <a href="mailto:support@grocerylist.app">support@grocerylist.app</a>
        </p>

        <h2>Privacy</h2>
        <p>
          To exercise your data rights or ask a question about how we handle
          personal data, contact us at{' '}
          <a href="mailto:privacy@grocerylist.app">privacy@grocerylist.app</a>.
        </p>

        <h2>Legal</h2>
        <p>
          For legal enquiries, contact us at{' '}
          <a href="mailto:legal@grocerylist.app">legal@grocerylist.app</a>.
        </p>

        <p>
          See also our <a href="/privacy">Privacy Policy</a> and{' '}
          <a href="/terms">Terms of Use</a>.
        </p>
      </div>
    </div>
  );
}