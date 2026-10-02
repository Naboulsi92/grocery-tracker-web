import type { Metadata } from 'next';
import { ContactContent } from './content';

export const metadata: Metadata = {
  title: 'Contact - Grocery Tracker',
  description: 'Get in touch with the Grocery Tracker team for questions, feedback, or support.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return <ContactContent />;
}
