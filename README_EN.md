# Surgical DevOps

[![Accelerator Conformance](https://github.com/bonushora/surgical-dev-ops/actions/workflows/accelerator-conformance.yml/badge.svg)](https://github.com/bonushora/surgical-dev-ops/actions/workflows/accelerator-conformance.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> A deterministic operational boundary for AI-assisted probabilistic engineering agents.

English: [README.md](./README.md)

Surgical DevOps is an open-source development orchestrator that keeps AI models
outside the operational trust boundary. Models may reason, explain, and propose.
Human authority, scope, execution, evidence, mutation, and failure handling remain
governed by deterministic contracts.

The project **does not** claim to make a language model deterministic. It makes the
operational system around the model explicit, bounded, auditable, and fail-closed.

## Current qualified baseline

| Evidence | Value |
| --- | --- |
| Release line | Surgical DevOps v2.6.0-rc.6 |
| Governed experience local checkpoint | `f56750eba3aa07b0426f56021c072a280468ea98` |
| Initial ADR-034 implementation checkpoint | `2f8d9e1aa40d0d7a127e966a28e475e0f89c4bb0` |
| Local qualification of the integrated NATURAL gateway | ADR-036 + ADR-037 on `release/v2.6.0-rc.6`, built on `9ed86a443da18f923b60692d7446f1fd57d0a2da` |
| Published predecessor with native CI | [`56da715284704f227675961d476e19acce6e9fa3`](https://github.com/bonushora/surgical-dev-ops/commit/56da715284704f227675961d476e19acce6e9fa3), [Accelerator Conformance #33286652480](https://github.com/bonushora/surgical-dev-ops/actions/runs/33286652480) |
| Published predecessor matrix | Ubuntu, macOS and Windows: **PASS** |
| Local canonical suite | 1212 tests discovered; 1207 passed; 0 failures; 5 platform-specific skips |
| Normative protocols | v2.2 preserved; v2.3 current |

The complete trail, including runs that failed before the green baseline, is in
[Engineering Evidence](./docs/ENGINEERING_EVIDENCE.md).
Independent reviewers can start with the
[External Engineering Review Package](./docs/EXTERNAL_ENGINEERING_REVIEW.md).

## Why this project exists

AI engineering tools are probabilistic, but filesystem writing, process execution,
Git state, credentials, and production mutation require deterministic authority:

```text
Human objective
      |
      v
Probabilistic cognition (without operational authority)
      |
      v
Deterministic admission and authority contracts
      |
      v
Canonical Orchestrator
      |
      v
Governed adapter -> bound evidence or fail-closed result
```

The AI provider never becomes an authority provider. A useful answer, a plan, or a
confident model output does not authorize a physical operation.

## Core invariants

- **Human sovereignty:** critical authority originates from verified human intent.
- **Intent is not authority:** natural language does not create capabilities.
- **Inspect first:** mutation requires declarative inspection and bounded scope.
- **PATCH by default:** minimal changes take precedence over broad rewrites.
- **Exact grants:** operations bind action, target, workspace, lifecycle, risk, and identity.
- **No direct model execution:** cognitive providers receive no filesystem, shell,
  process, network, credential, or mutation authority.
- **Durable mutation state:** locking, journal, commit authority, recovery, and
  replay remain explicit.
- **Fail-closed:** absent, invalid, expired, ambiguous, or unqualified evidence
  cannot become success.

## Platform qualification

| Platform | Qualified mechanism | Current evidence |
| --- | --- | --- |
| Linux | Bubblewrap deny-default containment and POSIX primitives | Canonical matrix: PASS |
| macOS | Seatbelt deny-default profile applied by a fixed native helper | Canonical matrix: PASS |
| Windows | Fixed Win32 security/durability helper and governed adapters | Canonical matrix: PASS |

These mechanisms are not presented as identical sandboxes. They are different
native implementations evaluated against shared bounded contracts. See
[Engineering Evidence](./docs/ENGINEERING_EVIDENCE.md).

## Governed AI and interaction modes

- **NATURAL:** outcome-oriented language and progressive disclosure.
- **ENGINEER:** natural language with relevant technical evidence.
- **EXPERT:** deterministic command-oriented control.

The reference local provider is Ollama when available. Providers are replaceable
and remain outside operational authority. Broad analyses in NATURAL mode pass
through human authorization, bind a deterministic physical workspace session,
open a governed discovery index, apply sensitive-content inspection before
exposure to the provider, evaluate micro-readings against a bounded task envelope,
and record content-free auditing.

For advanced repository engineering, OpenAI Codex is the recommended reference
agent and the closest target to the complete conversational development cycle.
This recommendation grants no privileged authority and makes no universal claim
of comparative superiority. See the
[bilingual AI agent selection guide](./docs/AI_PROVIDER_SELECTION_PT-BR.md).

The ENGINEER mode adds an immutable proposal bound to the READ_FILE target and the
actually observed BEFORE SHA-256. The flow obligatorily stops at
`HUMAN_AUTHORITY_REQUIRED`; physical mutation remains an explicit, separate R3
operation.

## Quick start

Declared runtime: Node.js `>=24.18.0`.

```bash
npm install -g surgical-dev-ops
surgical-devops --version
surgical-devops --help
surgical-devops
```

The compatibility executable `surgical` is also provided. To run the suite:

On first execution in a human terminal, bilingual onboarding selects one of the
three experiences provided by the same installation: `NATURAL`, `ENGINEER`, or
`EXPERT`. To redo the interface preference:

```bash
surgical-devops --configure
```

To use a profile only for the current invocation, without changing the saved
preference:

```bash
surgical-devops --interaction NATURAL
surgical-devops --interaction ENGINEER
surgical-devops --interaction EXPERT
```

To select the full language of human surfaces only for the current invocation,
without rewriting the saved preference:

```bash
surgical-devops --language pt-BR
surgical-devops --language en
```

The preference contains no operational authority. All profiles use the same
Orchestrator and the same BH-SEP/BH-SDP, R3, journal, Manifest CAS, and anti-replay
contracts.

To run the suite:

```bash
npm ci
npm test
```

## Normative protocols and immutable RAW artifacts

The original Portuguese BH-SEP v2.2 and BH-SDP v2.2 artifacts are frozen at
stable paths. They are not replaced by the international README or by English
translations.

- [BH-SEP v2.2 — original RAW](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)
- [BH-SDP v2.2 — original RAW](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)
- [BH-SEP v2.2 — English translation](./protocols/BH-SEP_EN.md)
- [BH-SDP v2.2 — English translation](./protocols/BH-SDP_EN.md)

### v2.3 — current

- [BH-SEP v2.3 — PT-BR](./protocols/v2.3/BH-SEP.md)
- [BH-SDP v2.3 — PT-BR](./protocols/v2.3/BH-SDP.md)
- [BH-SEP v2.3 — EN](./protocols/v2.3/BH-SEP_EN.md)
- [BH-SDP v2.3 — EN](./protocols/v2.3/BH-SDP_EN.md)
- [Copy both protocols — PT-BR](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-PROTOCOLS.md)
- [Copy both protocols — EN](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/v2.3/BH-PROTOCOLS_EN.md)

Future versions must use new versioned paths and may not overwrite or redirect the
original RAW files. See [Protocol Preservation](./protocols/README.md) and
[ADR-018](./docs/adr/ADR-018-immutable-protocol-raw-and-international-documentation.md).

## Architecture and evidence

- [Engineering Evidence Trail](./docs/ENGINEERING_EVIDENCE.md)
- [Documentation Map](./docs/DOCUMENTATION.md)
- [Trust Boundary — ADR-004](./docs/adr/ADR-004-surgical-devops-orchestrator-trust-boundary.md)
- [Human Authority — ADR-006](./docs/adr/ADR-006-authenticated-human-authority-boundary.md)
- [Journal and Recovery — ADR-007](./docs/adr/ADR-007-governed-mutation-transaction-recovery.md)
- [Windows Adapter — ADR-008](./docs/adr/ADR-008-windows-native-filesystem-safety-durability.md)
- [Content-Addressed Authority — ADR-010](./docs/adr/ADR-010-governed-content-addressed-workspace-authority.md)
- [Interaction Modes — ADR-011](./docs/adr/ADR-011-intent-driven-orchestration-user-modes.md)
- [Governed AI Behavior — ADR-014](./docs/adr/ADR-014-governed-ai-behavior-contract.md)
- [Complete Bilingual Human Experience — ADR-031](./docs/adr/ADR-031-complete-bilingual-human-experience_PT-BR.md)
- [Deterministic Governed Workspace Experience — ADR-034](./docs/adr/ADR-034-deterministic-governed-workspace-experience.md)
- [Governed NATURAL Agentic Experience — ADR-036](./docs/adr/ADR-036-natural-agentic-governed-experience.md)
- [Integrated Governed Agent Gateway — ADR-037](./docs/adr/ADR-037-integrated-governed-agent-gateway-and-conversational-control-surface.md)

## What green CI does not claim

- It is not proof of absolute security.
- It does not make the model's probabilistic reasoning deterministic.
- It does not claim universal durability against physical power loss.
- `POWER_LOSS_VALIDATED` remains false until specific physical qualification.
- Strict pathname CAS remains unqualified according to ADR-009.
- Windows, Linux, and macOS do not have identical isolation primitives.
- External adversarial review remains a separate qualification.
- The reproducible external challenge is available at
  [`docs/review/TRY_TO_BREAK_IT.md`](docs/review/TRY_TO_BREAK_IT.md).

Unsupported claims remain unqualified rather than becoming green.

## Contributing and license

Read [CONTRIBUTING.md](./CONTRIBUTING.md). Changes must preserve the authority
model, bilingual parity, stable RAW files, and fail-closed behavior.

[MIT](./LICENSE) © 2026 Thales Rangel.
