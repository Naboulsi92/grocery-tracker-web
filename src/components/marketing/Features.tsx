export function Features() {
  const features = [
    {
      emoji: '⚡',
      title: 'Real-time sync',
      description: 'Changes update instantly for all household members',
    },
    {
      emoji: '📋',
      title: 'Shared lists',
      description: 'One list, multiple users - never buy duplicates',
    },
    {
      emoji: '🔢',
      title: 'Smart quantities',
      description: 'Track amounts and get low-stock alerts',
    },
    {
      emoji: '🏷️',
      title: 'Categories',
      description: 'Organize by department for efficient shopping',
    },
  ];

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-12">
          Everything you need for shared shopping
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200 min-h-[160px] flex flex-col justify-center"
            >
              <div className="text-4xl sm:text-5xl mb-4">{feature.emoji}</div>
              <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
