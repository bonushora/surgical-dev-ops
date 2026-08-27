# Surgical DevOps

[![Accelerator Conformance](https://github.com/bonushora/surgical-dev-ops/actions/workflows/accelerator-conformance.yml/badge.svg)](https://github.com/bonushora/surgical-dev-ops/actions/workflows/accelerator-conformance.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> A deterministic operational boundary for probabilistic AI engineering agents.

Português: [README_PT-BR.md](./README_PT-BR.md)

Surgical DevOps is an open-source development orchestrator that keeps AI models
outside the operational trust boundary. Models may reason, explain, and propose.
Human authority, scope, execution, evidence, mutation, and failure handling remain
governed by deterministic contracts.

The project does **not** claim to make a language model deterministic. It makes the
operational system around the model explicit, bounded, auditable, and fail-closed.

## Current qualified baseline

| Evidence | Value |
| --- | --- |
| Release line | Surgical DevOps v2.6.0-rc.2 |
| Canonical commit | [`36ef01f53690e644976668248499ab9d5031f52f`](https://github.com/bonushora/surgical-dev-ops/commit/36ef01f53690e644976668248499ab9d5031f52f) |
| Canonical CI run | [Accelerator Conformance #32808535616](https://github.com/bonushora/surgical-dev-ops/actions/runs/32808535616) |
| Matrix result | Ubuntu, macOS, and Windows: **PASS** |
| Canonical suite | 864 tests discovered; 859 passed; 0 failures; 5 platform-specific skips |
| Normative protocols | BH-SEP v2.2 + BH-SDP v2.2 |

The complete trail, including failed runs that preceded the green baseline, is
documented in [Engineering Evidence](./docs/ENGINEERING_EVIDENCE.md).
Independent reviewers can start with the
[External Engineering Review Package](./docs/EXTERNAL_ENGINEERING_REVIEW.md).

## Why this exists

AI engineering tools are probabilistic, but filesystem writes, process execution,
Git state, credentials, and production mutation require deterministic authority.
Surgical DevOps separates those concerns:

```text
Human objective
      |
      v
Probabilistic cognition (no operational authority)
      |
      v
Deterministic admission and authority contracts
      |
      v
Canonical Orchestrator
      |
      v
Governed platform adapter -> bound evidence or fail-closed result
```

The AI provider never becomes an authority provider. A useful answer, a plan, or
a confident model output is not sufficient to authorize a physical operation.

## Core invariants

- **Human sovereignty:** critical authority originates from verified human intent.
- **Intent is not authority:** natural language cannot mint capabilities.
- **Inspect first:** mutation requires declarative inspection and bounded scope.
- **PATCH by default:** minimal changes are preferred over broad rewrites.
- **Exact grants:** operations bind action, target, workspace, lifecycle, risk,
  and identity.
- **No direct model execution:** cognitive providers receive no filesystem, shell,
  process, network, credential, or mutation authority.
- **Durable mutation state:** locking, journal stages, commit authority, recovery,
  and replay handling remain explicit.
- **Fail closed:** missing, malformed, expired, ambiguous, or unqualified evidence
  cannot become success.

## Platform qualification

The core contract is operating-system agnostic. Native adapters satisfy bounded
parts of that contract using platform-specific primitives.

| Platform | Qualified mechanism | Current evidence |
| --- | --- | --- |
| Linux | Bubblewrap deny-default containment and POSIX primitives | Canonical matrix job: PASS |
| macOS | Seatbelt deny-default profile applied by a fixed native helper | Canonical matrix job: PASS |
| Windows | Fixed Win32 filesystem safety/durability helper and governed adapters | Canonical matrix job: PASS |

These mechanisms are not represented as identical operating-system sandboxes.
They are different native implementations evaluated against common bounded
contracts. The exact claims and limitations are in
[Engineering Evidence](./docs/ENGINEERING_EVIDENCE.md).

## Governed AI and interaction modes

Surgical DevOps v2.5 provides three interaction profiles without changing the
underlying authority model:

- **NATURAL:** outcome-oriented language and progressive disclosure.
- **ENGINEER:** natural language plus relevant technical evidence.
- **EXPERT:** deterministic command-oriented control.

The reference local cognitive provider is Ollama when available. Providers are
replaceable and remain outside operational authority. If a cognitive provider is
unavailable, deterministic behavior remains active and fails safely.

Broad project analysis in NATURAL mode crosses explicit human authorization and a
governed recursive evidence loop. Workspace facts must come from
Orchestrator-qualified evidence, not model memory or inference.

ENGINEER mode extends this path with one immutable proposal bound to the exact
governed READ_FILE target and BEFORE SHA-256. It stops at
`HUMAN_AUTHORITY_REQUIRED`; physical mutation remains a separate explicit R3
operation.

## Quick start

Declared runtime: Node.js `>=24.18.0`.

```bash
npm install -g surgical-dev-ops
surgical-devops --version
surgical-devops --help
```

Start the governed CLI:

```bash
surgical-devops
```

The compatibility executable `surgical` is also provided. Run the canonical suite
from a checkout with:

```bash
npm ci
npm test
```

## Normative protocols and immutable RAW artifacts

The original Portuguese BH-SEP v2.2 and BH-SDP v2.2 artifacts are frozen at
stable paths. They are not replaced by this international README or by English
translations.

- [BH-SEP v2.2 — original RAW](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)
- [BH-SDP v2.2 — original RAW](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)
- [BH-SEP v2.2 — English translation](./protocols/BH-SEP_EN.md)
- [BH-SDP v2.2 — English translation](./protocols/BH-SDP_EN.md)

Future protocol versions must use new versioned paths. They must not overwrite or
repurpose the original v2.2 RAW URLs. See
[Protocol Preservation and Versioning](./protocols/README.md) and
[ADR-018](./docs/adr/ADR-018-immutable-protocol-raw-and-international-documentation.md).

## Architecture and evidence

- [Engineering Evidence Trail](./docs/ENGINEERING_EVIDENCE.md)
- [Documentation Map](./docs/DOCUMENTATION.md)
- [Orchestrator Trust Boundary — ADR-004](./docs/adr/ADR-004-surgical-devops-orchestrator-trust-boundary.md)
- [Authenticated Human Authority — ADR-006](./docs/adr/ADR-006-authenticated-human-authority-boundary.md)
- [Mutation Journal and Recovery — ADR-007](./docs/adr/ADR-007-governed-mutation-transaction-recovery.md)
- [Windows Native Adapter — ADR-008](./docs/adr/ADR-008-windows-native-filesystem-safety-durability.md)
- [Content-Addressed Mutation Authority — ADR-010](./docs/adr/ADR-010-governed-content-addressed-workspace-authority.md)
- [Interaction Modes — ADR-011](./docs/adr/ADR-011-intent-driven-orchestration-user-modes.md)
- [Governed AI Behavior — ADR-014](./docs/adr/ADR-014-governed-ai-behavior-contract.md)

## What the green CI does not claim

- It is not a proof of absolute security.
- It does not make probabilistic model reasoning deterministic.
- It does not claim universal physical power-loss durability.
- `POWER_LOSS_VALIDATED` remains false pending physical qualification.
- Strict pathname-level Physical Identity-Conditional CAS remains explicitly
  unqualified at the boundary documented by ADR-009.
- Windows, Linux, and macOS do not expose identical isolation primitives.
- External adversarial engineering review remains a separate qualification step.
- The reproducible external challenge is available in
  [`docs/review/TRY_TO_BREAK_IT.md`](docs/review/TRY_TO_BREAK_IT.md).

Unsupported claims remain unqualified rather than being converted into green
results.

## Contributing and license

Read [CONTRIBUTING.md](./CONTRIBUTING.md). Changes must preserve the authority
model, bilingual parity for public entry documents, stable protocol RAW artifacts,
and fail-closed behavior.

[MIT](./LICENSE) © 2026 Thales Rangel.
