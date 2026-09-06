# The dashboard is the authenticated shell and tolerates onboarding

The dashboard route is deliberately **not** wrapped in the private-route guard. It resolves the access state itself and renders in all three cases: anonymous visitors are sent to sign-in, onboarding users get the authenticated header plus a prompt to create or join a household, and members get the dashboard. Every other authenticated route keeps the hard guard and redirects onboarding users away.

## Considered Options

**Guard the dashboard like its siblings.** This was the status quo, and it is why "return to my dashboard" from onboarding was impossible: the guard sends onboarding users to onboarding, so a return link pointing at the dashboard bounced straight back in an infinite loop. Rejected for that reason.

**Parameterize the guard to tolerate onboarding on one route.** Rejected: it puts a route-specific branch inside a component shared by every authenticated route, so the one route that behaves differently ends up defining the guard's interface for all of them.

**Make the other routes tolerant too.** Rejected: onboarding users have no household, so the inventory screens have nothing to show them. The hard redirect is the correct behaviour there.

## Consequences

- The dashboard is the one authenticated route that renders without a resolved household. Anything added to it must handle the onboarding state explicitly rather than assuming a household exists.
- The guard stays a simple "one way in, hard redirect otherwise" component with no per-route options, which keeps its decision function pure and trivially testable.
- A member whose household disappears mid-session now sees the onboarding prompt on the dashboard instead of being bounced. That is the intended behaviour, but it means the dashboard's empty state is user-facing rather than defensive.
