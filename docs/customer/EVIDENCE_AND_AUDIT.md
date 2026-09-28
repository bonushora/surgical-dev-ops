# Evidence and audit

`surgical evidence --json` exports bounded customer evidence without requiring
direct access to internal state. Evidence correlates request, authority reference,
workspace/repository identity, BEFORE/AFTER state, CAS, physical result, tests,
journal/recovery outcome, terminal effect, protocol, and qualified component.

Exports exclude credentials, private keys, secret values, repository source, and
hidden model reasoning. Evidence fingerprints remain stable for audit correlation.
