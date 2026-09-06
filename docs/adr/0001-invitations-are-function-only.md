# Invitations are reachable only through stored functions

The invitations table has row level security enabled, **no policies**, and **no grants** to any client role. Every operation on it — create, read, revoke, consume — goes through a security-definer stored function, and the owner check lives in the function body rather than in a policy.

## Considered Options

**Policies on the table.** Rejected: the owner check spans the row's household, and more decisively the token is stored only as a digest, so a policy could never match an incoming token against a row. A select policy would be dead weight that looks like protection.

**Grants plus application-level checks.** Rejected: the client is untrusted, and a grant to `anon` or `authenticated` is a grant to anyone with a browser.

## Consequences

- Because no client can read the table directly, reading the household's live invitation requires a dedicated function — and that function must never return the token.
- Adding a policy or a grant to this table later would silently weaken this decision. If you find yourself wanting one, revisit this ADR rather than adding it.
- Replacing a function discards the privileges attached to it. Any migration that drops and recreates one of these functions **must** re-issue the grants in the same file, or the functions end up uncallable with no error to explain why.
