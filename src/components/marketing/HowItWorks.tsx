export function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Create your household',
      description: 'Set up your shared space in seconds',
    },
    {
      number: 2,
      title: 'Add items to your list',
      description: 'What do you need? Add it instantly',
    },
    {
      number: 3,
      title: 'Shop together',
      description: 'Real-time updates as you shop',
    },
    {
      number: 4,
      title: 'Never forget again',
      description: 'Smart reminders for recurring items',
    },
  ];

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-12">
          How It Works
        </h2>
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-center md:items-stretch justify-center">
          {steps.map((step, index) => (
            <div key={step.number} className="flex-1 flex flex-col items-center text-center">
              <div className="relative flex flex-col items-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg">
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-blue-300 -translate-y-1/2 z-0" style={{ width: 'calc(100% + 2rem)' }} />
                )}
              </div>
              <div className="mt-4 sm:mt-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
