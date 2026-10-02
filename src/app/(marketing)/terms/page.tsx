import type { Metadata } from 'next';
import { TermsContent } from './content';

export const metadata: Metadata = {
  title: 'Terms of Use - Grocery Tracker',
  description: 'Terms of use for the Grocery Tracker. Read the terms governing your use of the service.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return <TermsContent />;
}
