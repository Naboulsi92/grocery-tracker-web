# The invitation token is stored only as a digest and shown once

Only a SHA-256 digest of the invitation token is persisted. The raw token is returned exactly once, at creation, and never again — it cannot be recovered, re-displayed, or read out of a database dump.

## Considered Options

**Store the token in the clear so it can be re-displayed.** Rejected: a database leak would hand an attacker a working key into every household that had a pending invitation.

**Encrypt it reversibly.** Rejected: it buys nothing the digest does not. Verification only ever needs to compare digests, and reversible encryption would require a key management story this project does not have.

## Consequences

- "Show me the code again" is not implementable, now or at any point in the future. Every invitation interface has to be designed around a single display of the token, and the interface must say so plainly at the moment it is shown.
- Because the token cannot be redisplayed, the function that reads a household's live invitation returns metadata only — creation time, expiry, and whether it has been consumed or revoked.
- Because a token the owner cannot see is a token they cannot reason about, a household is limited to one live invitation: issuing a new one retires the previous. This keeps "what invitation is out there right now" answerable without the token.
