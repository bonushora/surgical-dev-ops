# NATURAL commit-bound project evidence index

ADR-024-C adds a bounded, immutable, read-only index for evidence that has
already crossed the canonical Surgical DevOps Orchestrator.

An entry is reusable only when its physical workspace identity, repository
`HEAD`, worktree fingerprint, canonical target, content SHA-256, byte count and
parser version remain compatible. A changed binding produces `STALE`; an absent
target produces `MISS`. A governing contract that requires fresh physical
evidence always bypasses an otherwise valid hit.

The index is session-local in this milestone. It performs no filesystem, Git,
process, network or provider operation and grants neither operational nor
mutation authority. Governed persistent project memory remains ADR-024-D.

Run the deterministic contract demonstration with:

```sh
npm run evaluate:natural:evidence-index
```

The demonstration emits identifiers and cost classification only. It does not
emit project content.
