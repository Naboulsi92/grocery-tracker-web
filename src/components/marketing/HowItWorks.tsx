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
    <section className="mk-section mk-section-tinted" id="how-it-works">
      <div className="mk-container">
        <h2 className="mk-h2">How it works</h2>
        <p className="mk-section-sub">
          From signup to a full cart in four steps — no app download, no setup
          meeting with your roommates.
        </p>
        <div className="mk-steps">
          {steps.map((step) => (
            <div key={step.number} className="mk-step">
              <div className="mk-step-num" aria-hidden="true">
                {step.number}
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
