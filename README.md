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
| Release line | Surgical DevOps v2.6.0-rc.6 |
| Local governed workspace checkpoint | `f56750eba3aa07b0426f56021c072a280468ea98` |
| Initial ADR-034 implementation checkpoint | `2f8d9e1aa40d0d7a127e966a28e475e0f89c4bb0` |
| Local integrated NATURAL gateway qualification | ADR-036 + ADR-037 on `release/v2.6.0-rc.6`, building on `9ed86a443da18f923b60692d7446f1fd57d0a2da` |
| Published native CI predecessor | [`56da715284704f227675961d476e19acce6e9fa3`](https://github.com/bonushora/surgical-dev-ops/commit/56da715284704f227675961d476e19acce6e9fa3), [Accelerator Conformance #33286652480](https://github.com/bonushora/surgical-dev-ops/actions/runs/33286652480) |
| Published predecessor matrix | Ubuntu, macOS, and Windows: **PASS** |
| Local canonical suite | 1212 tests discovered; 1207 passed; 0 failures; 5 platform-specific skips |
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

Surgical DevOps v2.6 provides three interaction profiles without changing the
underlying authority model:

- **NATURAL:** outcome-oriented language and progressive disclosure.
- **ENGINEER:** natural language plus relevant technical evidence.
- **EXPERT:** deterministic command-oriented control.

The reference local cognitive provider is Ollama when available. Providers are
replaceable and remain outside operational authority. If a cognitive provider is
unavailable, deterministic behavior remains active and fails safely.

For advanced repository engineering, OpenAI Codex is the recommended reference
agent and the target closest to the complete conversational development loop.
This recommendation does not grant privileged authority and does not claim
universal comparative superiority. See the bilingual
[AI provider selection guide](./docs/AI_PROVIDER_SELECTION.md).

Broad project analysis in NATURAL mode crosses explicit human authorization,
binds a deterministic physical workspace session, opens a governed discovery
index, applies sensitive-content inspection before provider exposure, evaluates
microreads against a bounded task envelope, and records content-free audit
events. Workspace facts must come from Orchestrator-qualified evidence, not
model memory or inference.

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

On the first human terminal launch, a bilingual onboarding selects one of the
three experiences provided by this same installation: `NATURAL`, `ENGINEER` or
`EXPERT`. Reconfigure the saved interface preference with:

```bash
surgical-devops --configure
```

Use an invocation-scoped override without changing the saved preference:

```bash
surgical-devops --interaction NATURAL
surgical-devops --interaction ENGINEER
surgical-devops --interaction EXPERT
```

Select the complete human-facing language for one invocation without rewriting
the saved preference:

```bash
surgical-devops --language en
surgical-devops --language pt-BR
```

The preference contains no operational authority. All profiles use the same
Orchestrator, BH-SEP/BH-SDP, R3, journal, Manifest CAS and anti-replay contracts.

The compatibility executable `surgical` is also provided. Run the canonical suite
from a checkout with:

```bash
npm ci
npm test
```

## Normative protocols and immutable RAW artifacts

### v2.2 — histórica e preservada

- [BH-SEP v2.2 — original RAW](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)
- [BH-SDP v2.2 — original RAW](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)
- [BH-SEP v2.2 — English translation](./protocols/BH-SEP_EN.md)
- [BH-SDP v2.2 — English translation](./protocols/BH-SDP_EN.md)

### v2.3 — atual

- [BH-SEP v2.3 — RAW original](./protocols/v2.3/BH-SEP.md)
- [BH-SDP v2.3 — RAW original](./protocols/v2.3/BH-SDP.md)
- [BH-SEP v2.3 — tradução inglesa](./protocols/v2.3/BH-SEP_EN.md)
- [BH-SDP v2.3 — tradução inglesa](./protocols/v2.3/BH-SDP_EN.md)

#### Cópia conjunta da v2.3

- [Copiar BH-SEP + BH-SDP v2.3 — RAW original](./protocols/v2.3/BH-PROTOCOLS.md)
- [Copiar BH-SEP + BH-SDP v2.3 — tradução inglesa](./protocols/v2.3/BH-PROTOCOLS_EN.md)

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
- [Complete Bilingual Human Experience — ADR-031](./docs/adr/ADR-031-complete-bilingual-human-experience.md)
- [Deterministic Governed Workspace Experience — ADR-034](./docs/adr/ADR-034-deterministic-governed-workspace-experience.md)
- [NATURAL Agentic Governed Experience — ADR-036](./docs/adr/ADR-036-natural-agentic-governed-experience.md)
- [Integrated Governed Agent Gateway — ADR-037](./docs/adr/ADR-037-integrated-governed-agent-gateway-and-conversational-control-surface.md)

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
