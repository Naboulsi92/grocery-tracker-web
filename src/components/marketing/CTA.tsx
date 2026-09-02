import Link from 'next/link';

export function CTA() {
  const handleCTAClick = (e: React.MouseEvent<HTMLAnchorElement>, ctaName: string) => {
    if ((window as any).plausible) {
      (window as any).plausible('CTAClick', { 
        props: { 
          name: ctaName,
          element: e.currentTarget.tagName,
          href: e.currentTarget.getAttribute('href') || 'N/A'
        } 
      });
    }
  };

  return (
    <section id="cta" className="py-16 sm:py-20 bg-blue-600 dark:bg-blue-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Ready to simplify your shopping?
        </h2>
        <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
          Join thousands of households shopping smarter together
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/signup"
            data-cta-name="Bottom_GetStarted"
            onClick={(e) => handleCTAClick(e, 'Bottom_GetStarted')}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-blue-600 bg-white rounded-lg hover:bg-blue-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Get Started Free
          </Link>
          <p className="text-blue-100 text-sm">
            No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}
