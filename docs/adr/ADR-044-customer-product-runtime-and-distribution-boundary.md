# ADR-044 — Customer product runtime and distribution boundary

- Status: ACCEPTED / FROZEN
- Date: 2026-09-28
- Related: ADR-042, ADR-043; Control Plane ADR-0018, ADR-0019, ADR-0020

## Decision

The `surgical` executable is the single supported customer entry point for the
commercial-beta runtime. It projects lifecycle, initialization, diagnostics,
repository onboarding, provider configuration, evidence, recovery inspection,
backup, upgrade checks, demo, and removal over the existing deterministic core.
The executable, daemon, configuration, product profiles, and visual or CLI
surfaces are not authority owners.

The packaged runtime is self-contained and must not import a development
checkout. Readiness is established through a private local IPC handshake, not a
PID or delay. Customer state is private, versioned, exact-schema, and fail-closed.
Configuration uses secret references, never plaintext credentials, and never
mints physical or recovery authority.

Distribution is an npm-compatible artifact for the qualified Node runtime. A
native acceptance installation must exercise the packaged artifact before it is
eligible for feature-branch publication. Artifacts receive SHA-256 manifests;
signing remains a future qualified release-infrastructure boundary and no ad-hoc
signing key is created.

## Preserved authority boundary

V1 and v2 schemas and digests remain unchanged; no v3 is introduced. Surgical
DevOps remains the only owner of local human authority, CAS, mutation journals,
physical execution, and recovery. Product commands do not authorize push,
merge, release, deployment, arbitrary shell, generic network mutation, or
arbitrary filesystem mutation.

## Limitations

Active in-flight mutation remains non-interruptible. Universal power-loss
immunity is not claimed. Enterprise identity, external secret stores, complete
segregation-of-duties enforcement, signing, and compliance certification are
not part of this accepted decision.
