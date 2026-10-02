import type { Metadata } from 'next';
import { PrivacyContent } from './content';

export const metadata: Metadata = {
  title: 'Privacy Policy - Grocery Tracker',
  description: 'Privacy policy for the Grocery Tracker. Learn how we collect, use, and protect your data.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
