import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use - Grocery List App',
  description: 'Terms of use for the Grocery List App. Read the terms governing your use of the service.',
  alternates: {
    canonical: 'https://grocerylist.app/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>Terms of Use</h1>
        <p className="mk-legal-date">Last updated: September 15, 2026</p>

        <p>
          These Terms of Use (&quot;Terms&quot;) govern your access to and use of
          the Grocery List application and related services (the
          &quot;Service&quot;). By creating an account or using the Service, you
          agree to be bound by these Terms.
        </p>

        <h2>1. Description of Service</h2>
        <p>
          Grocery List is a collaborative grocery inventory management platform
          that allows households to share shopping lists, manage item quantities,
          and coordinate purchases in real-time. The Service is provided via a
          web application accessible from supported modern browsers.
        </p>

        <h2>2. Account Registration</h2>
        <p>
          You must create an account to use the Service. You may register using
          an email address and password, or via a supported third-party
          authentication provider (Google, Apple). You are responsible for
          maintaining the confidentiality of your account credentials.
        </p>

        <h2>3. User Responsibilities</h2>
        <p>You agree to:</p>
        <ul>
          <li>
            Provide accurate and current information when creating your account.
          </li>
          <li>
            Use the Service only for its intended purpose of personal
            household grocery list management.
          </li>
          <li>
            Not share your account credentials with others or allow unauthorised
            access to your account.
          </li>
          <li>
            Not use the Service for any unlawful purpose or in violation of any
            applicable law or regulation.
          </li>
          <li>
            Not attempt to disrupt, compromise, or gain unauthorised access to
            the Service or its underlying infrastructure.
          </li>
        </ul>

        <h2>4. Household Membership</h2>
        <p>
          The Service enables shared lists within household groups. By joining a
          household, other members can see and modify shared list data. You are
          responsible for managing your household membership and understanding
          what data is visible to other household members.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          The Service, including its design, code, and content (excluding user
          data), is owned by Grocery List and protected by intellectual property
          laws. You retain full ownership of all grocery list data and personal
          content you create within the Service.
        </p>

        <h2>6. Account Termination</h2>
        <p>
          You may delete your account at any time from the account settings
          within the Service. Upon deletion, your personal data will be removed
          in accordance with our{' '}
          <a href="/privacy">Privacy Policy</a>. We reserve the right to
          suspend or terminate accounts that violate these Terms.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind. To the maximum extent permitted by
          applicable law, we shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages, nor for any loss of
          profits, data, or business opportunities arising from your use of the
          Service.
        </p>

        <h2>8. Disclaimer of Warranties</h2>
        <p>
          We do not warrant that the Service will be uninterrupted, error-free,
          or free from harmful components. We make no guarantees regarding the
          reliability or availability of the Service at any given time.
        </p>

        <h2>9. Changes to These Terms</h2>
        <p>
          We may modify these Terms from time to time. When we make material
          changes, we will notify you via email or a prominent notice within the
          Service before the changes take effect. Your continued use of the
          Service after the effective date constitutes acceptance of the updated
          Terms.
        </p>

        <h2>10. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws
          of the European Union and its member states. Any disputes arising from
          or relating to these Terms or the Service shall be subject to the
          exclusive jurisdiction of the courts of the applicable EU member state.
        </p>

        <h2>11. Contact</h2>
        <p>
          If you have any questions about these Terms, please contact us at{' '}
          <a href="mailto:legal@grocerylist.app">legal@grocerylist.app</a>.
        </p>
      </div>
    </div>
  );
}
