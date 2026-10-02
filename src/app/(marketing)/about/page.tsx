import type { Metadata } from 'next';
import { AboutContent } from './content';

export const metadata: Metadata = {
  title: 'About - Grocery Tracker',
  description: 'Learn more about the Grocery Tracker, a collaborative grocery inventory management platform for households.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return <AboutContent />;
}
