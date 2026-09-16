import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Grocery List App',
  description: 'Privacy policy for the Grocery List App. Learn how we collect, use, and protect your data.',
  alternates: {
    canonical: 'https://grocerylist.app/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>Privacy Policy</h1>
        <p className="mk-legal-date">Last updated: September 15, 2026</p>

        <p>
          This Privacy Policy explains how Grocery List (&quot;we&quot;, &quot;us&quot;,
          or &quot;our&quot;) collects, uses, and protects your personal information
          when you use our collaborative grocery list service (the &quot;Service&quot;).
        </p>

        <h2>1. Data We Collect</h2>
        <p>We collect the following personal data when you use the Service:</p>
        <ul>
          <li>
            <strong>Account information:</strong> email address and display name,
            provided when you sign up via email/password or a third-party
            authentication provider (Google, Apple).
          </li>
          <li>
            <strong>Grocery list data:</strong> items, quantities, and categories
            you add to your shared household lists.
          </li>
          <li>
            <strong>Household membership:</strong> your membership in one or more
            households and your role within each.
          </li>
          <li>
            <strong>Push notification subscription:</strong> the browser push
            notification endpoint stored on your device, used to deliver
            reminders you opt into.
          </li>
        </ul>

        <h2>2. Purpose of Data Processing</h2>
        <p>We process your data solely for the following purposes:</p>
        <ul>
          <li>Providing and maintaining the grocery list management service.</li>
          <li>Enabling real-time collaboration within your household.</li>
          <li>Sending push notification reminders you have subscribed to.</li>
          <li>Responding to support requests you submit to us.</li>
          <li>
            Improving the Service through aggregated, anonymised usage analytics
            (see Section 6).
          </li>
        </ul>

        <h2>3. Data Retention</h2>
        <ul>
          <li>
            <strong>Active accounts:</strong> your data is retained for as long as
            your account remains active.
          </li>
          <li>
            <strong>Account deletion:</strong> upon receiving a deletion request,
            all personal data is permanently removed within 7 days. Household
            data that references your account is anonymised.
          </li>
        </ul>

        <h2>4. Your Rights</h2>
        <p>
          Under the General Data Protection Regulation (GDPR) and applicable
          national laws, you have the following rights:
        </p>
        <ul>
          <li>
            <strong>Right of access:</strong> request a copy of the personal data
            we hold about you.
          </li>
          <li>
            <strong>Right to rectification:</strong> request correction of
            inaccurate or incomplete data.
          </li>
          <li>
            <strong>Right to erasure:</strong> request deletion of your personal
            data (&quot;right to be forgotten&quot;).
          </li>
          <li>
            <strong>Right to data portability:</strong> receive your data in a
            structured, commonly used, machine-readable format.
          </li>
          <li>
            <strong>Right to withdraw consent:</strong> where processing is based
            on consent, withdraw it at any time without affecting the lawfulness
            of prior processing.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:privacy@grocerylist.app">privacy@grocerylist.app</a>.
        </p>

        <h2>5. Data Hosting</h2>
        <p>
          All personal data is hosted on Supabase, which uses PostgreSQL databases
          hosted in the <strong>AWS EU (Frankfurt)</strong> region. Your data
          remains within the European Economic Area and is subject to GDPR
          protections.
        </p>

        <h2>6. Cookies and Analytics</h2>
        <p>
          We use <a href="https://plausible.io">Plausible Analytics</a>, a
          privacy-friendly, cookie-free analytics tool. Plausible does not use
          cookies and does not collect personally identifiable information.
          Aggregated usage statistics help us understand how the Service is used
          and improve it over time.
        </p>
        <p>
          No advertising cookies or third-party tracking cookies are placed on
          your device.
        </p>

        <h2>7. Push Notifications</h2>
        <p>
          If you opt into push notifications, your browser&apos;s push
          notification subscription endpoint is stored to deliver reminders you
          have configured. You can revoke push notification permissions at any
          time through your browser settings. Revoking permissions removes the
          stored subscription endpoint.
        </p>

        <h2>8. Data Sharing</h2>
        <p>
          We do not sell, rent, or trade your personal data. Your data is shared
          only with:
        </p>
        <ul>
          <li>
            Other members of households you have joined, limited to the data
            necessary for collaborative list management.
          </li>
          <li>
            Supabase, as our hosting and database infrastructure provider, under
            a data processing agreement.
          </li>
        </ul>

        <h2>9. Security</h2>
        <p>
          We implement appropriate technical and organisational measures to protect
          your data, including encryption in transit (TLS) and at rest,
          authentication via industry-standard protocols, and Row-Level Security
          policies that ensure users can only access data belonging to their
          household.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be communicated via email or a prominent notice within the Service.
          The &quot;Last updated&quot; date at the top of this page reflects the
          most recent revision.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise
          your data rights, please contact us at{' '}
          <a href="mailto:privacy@grocerylist.app">privacy@grocerylist.app</a>.
        </p>
      </div>
    </div>
  );
}
