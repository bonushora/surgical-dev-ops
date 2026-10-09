# External engineering review — start here

## 1. What is Surgical DevOps?

Surgical DevOps is a governed development-orchestration system that separates
probabilistic cognition from deterministic operational authority. Models may
analyze evidence and propose work; deterministic core components mediate
identity, scope, capability, state, CAS, mutation, recovery, and physical
effects.

## 2. What security property is being evaluated?

The central property is authority separation: model output, tool availability,
persisted context, and isolation do not themselves create operational authority.
The review package maps this property across delegated authority, expiry,
provenance, recovery, workspace identity, containment, replay/CAS, and human
sovereignty.

## 3. What is deterministic versus probabilistic?

```text
MODEL_OUTPUT_MAY_BE_PROBABILISTIC
AUTHORITY_ENFORCEMENT_IS_DETERMINISTIC
```

Model suggestions and natural-language interpretation may vary. Exact schemas,
allowlists, identity bindings, fingerprints, state transitions, capability
checks, CAS comparisons, and fail-closed decisions are deterministic at their
enforcement boundaries. Tests and CI qualify those bounded contracts; they do
not prove universal correctness.

## 4. Where does authority originate?

Human authority originates outside the model and is admitted through explicit,
bounded authority contracts described by ADR-006 and ADR-038. Mission authority
is non-transitive: local mutation does not imply push, merge, tag, release,
publication, or deployment.

## 5. Where is authority enforced?

Primary enforcement is in the deterministic Orchestrator, capability-grant,
task/envelope, workspace-boundary, production-mutation, journal, consumption,
and CAS components listed in the readiness matrix. Native containment is an
additional enforcement layer after authority has already been established.

## 6. What can the model not do by itself?

The model cannot mint human identity, sign a human challenge, widen target or
scope, bypass risk limits, dispatch arbitrary shell or mounts, inherit ambient
credentials, convert a proposal into mutation authority, restore consumed
authority, or infer push/release/deploy authority from local authority.

## 7. What survives restart or crash?

Durable mission, journal, CAS, and authorization-consumption evidence can be
reconciled after restart. Resume must revalidate current physical state;
conversation or stored model output does not restore operational authority.
Sudden physical power-loss guarantees are not claimed. Persisted authorization
records also retain the explicit limitations documented in
`AGMI-STORE-HARDENING-v1.md`, including unresolved authenticated-head and
same-slot rollback questions.

## 8. How is repository and workspace identity bound?

Canonical physical workspace roots, repository observations, content hashes,
operation fingerprints, Manifest CAS, and expected before/after evidence bind
operations to current physical state. Strict ordinary-pathname physical-identity
CAS is still explicitly unqualified.

## 9. Where are containment boundaries?

Provider containment is documented by BH-SEP/BH-SDP v2.4 and the containment
qualification records. Governed execution isolation is documented by ADR-046
and ADR-047. The Linux Bubblewrap provider denies ambient environment and
network, keeps the host root absent, exposes only the authorized workspace as
writable host-backed storage, and has no native fallback.

## 10. What does the isolated runtime add?

It adds Linux defense-in-depth for an already-authorized argv workload. An
external authorized executable is mapped as one read-only file at
`/runtime/authorized-executable`; its parent runtime tree is not mounted.

```text
ISOLATION_IS_NOT_AUTHORITY
HUMAN_AUTHORITY_REMAINS_SOVEREIGN
PRODUCTION_WIRING=NO
```

The provider remains experimental, is not enabled by default, and is not wired
into production NATURAL/ENGINEER/EXPERT flows.

## 11. What remains unqualified?

- macOS and Windows isolation backends;
- production wiring or default enablement of the Linux provider;
- OCI, VM, cgroup-backed, or SuperSandbox isolation;
- strict ordinary-pathname physical-identity CAS;
- universal side-channel or kernel-escape resistance;
- sudden physical power-loss guarantees;
- complete persisted-store rollback detection or an authenticated monotonic
  store head;
- universal agent safety or containment of hypothetical ASI;
- OWASP or third-party certification; and
- production deployment readiness resulting from this package.

macOS and Windows CI results establish canonical compatibility only.

## 12. How can a reviewer reproduce the evidence?

Use a clean clone at the reviewed SHA and Node.js compatible with `package.json`:

```bash
npm ci
npm run review:external:demo
node --test --test-concurrency=1 tests/accelerator/execution-isolation-structural.test.js
node --test --test-concurrency=1 tests/accelerator/execution-isolation-live.test.js
npm test
```

The physical demo and live isolation suite require Linux with qualified
Bubblewrap namespace support. Run them in host context if a managed command
sandbox blocks namespace creation; do not weaken policy. Begin detailed review
with the [R1–R15 readiness matrix](./EXTERNAL-ENGINEERING-REVIEW-READINESS-v0.1.md)
and the [package manifest](./EXTERNAL-REVIEW-PACKAGE-MANIFEST-v0.1.md).
