export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Grocery List
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Your shared grocery tracking application
        </p>
        <div className="flex justify-center space-x-4">
          <a
            href="/signup"
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
          >
            Get Started
          </a>
          <a
            href="/login"
            className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Login
          </a>
        </div>
      </section>

      {/* Features Section Placeholder */}
      <section className="py-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
          Features
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Placeholder 1
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Feature content coming soon
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Placeholder 2
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Feature content coming soon
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Placeholder 3
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Feature content coming soon
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section Placeholder */}
      <section className="py-16 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Join us today and start managing your grocery lists
          </p>
          <a
            href="/signup"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
          >
            Sign Up Now
          </a>
        </div>
      </section>
    </div>
  );
}
