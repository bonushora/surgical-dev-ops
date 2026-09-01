# Engineering Evidence Trail

## Purpose

This document records reproducible evidence for the current Surgical DevOps
multiplatform baseline. It distinguishes observed results from broader security
claims that remain unqualified.

## ADR-036 and ADR-037 integrated NATURAL gateway qualification

| Field | Evidence |
| --- | --- |
| Local implementation state | `release/v2.6.0-rc.6` worktree after ADR-036/ADR-037 runtime integration |
| NATURAL default checkpoint | `9ed86a443da18f923b60692d7446f1fd57d0a2da` |
| ADR freeze checkpoint | `dee764f7ac39ba0de16be6056cc2706ad629e99f` |
| Local canonical suite | 1206 tests discovered; 1201 passed; zero failures; 5 explicit platform skips |
| Package dry run | `npm pack --dry-run --json` completed for `surgical-dev-ops@2.6.0-rc.6` |
| Manual acceptance | Pending on the qualified local checkpoint; no push, tag, release, or publication authorized |
| Scope | Persistent NATURAL mission state, integrated governed agent gateway, conversational projections, no-copy/paste governed tool slices, and NATURAL semantic objective repair |

The local implementation adds a persistent governed NATURAL mission model with
explicit state, live plan, hash-chained event stream, mission projections,
governed resume and final GREEN qualification semantics. It also adds the
Integrated Governed Agent Gateway vertical slices for workspace status,
governed search, governed read, governed diff, governed test invocation,
authority inspection, contextual approval request creation, mission resume and
conditional mutation routing through the existing Surgical Orchestrator.

The gateway remains a structured mediation layer, not a shell. Tool
availability is separated from tool authority; unknown, malformed, stale,
unbound and CAS-mismatched requests fail closed. Sensitive evidence is inspected
and redacted or blocked before provider exposure. Provider substitution changes
cognition only and cannot expand filesystem, mutation, Git, network, release or
publish authority.

Perceived responsiveness is qualified through deterministic architecture rather
than arbitrary wall-clock promises: the gateway emits an early operation event,
streams real progress before long operations complete, normalizes large evidence
before cognition, exposes local deterministic fast paths for mission/status
views, and records latency trace boundaries without fabricating percentages or
success.

The NATURAL semantic acceptance repair distinguishes project state, engineering
health, architecture, readiness, and next-work objectives from repository
cleanliness. Compound analysis now reaches the existing bounded project-evidence
path and deterministically prefers available project-description,
engineering-state, and roadmap evidence before synthesis. The provider contract
must cover every requested semantic objective, ground project-specific claims,
and preserve uncertainty. Progress exposes real Orchestrator evidence,
provider-cognition, and synthesis transitions. The dedicated regression rejects
a clean-worktree-only answer as incomplete for a project-state-and-next-work
objective.

## ADR-034 governed workspace closure checkpoint

| Field | Evidence |
| --- | --- |
| Local checkpoint | `f56750eba3aa07b0426f56021c072a280468ea98` |
| Initial implementation checkpoint | `2f8d9e1aa40d0d7a127e966a28e475e0f89c4bb0` |
| Local canonical suite | 1179 tests discovered; 1174 passed; zero failures; 5 explicit platform skips |
| Scope | Deterministic governed workspace experience for NATURAL mode |
| Native CI predecessor | `56da715284704f227675961d476e19acce6e9fa3`, run `33286652480` |

The local checkpoint integrates ADR-034 into the actual NATURAL project
experience: a revalidated deterministic physical workspace session is opened
after human task authorization, the governed workspace inventory is projected
through the discovery index, contained microreads are evaluated against the task
envelope, sensitive content is blocked or redacted before provider exposure, the
qualified command catalog remains the validation boundary, and content-free
audit events are carried by the workspace projection.

The same checkpoint preserves the separate ENGINEER and EXPERT experiences.
ENGINEER still stops at `HUMAN_AUTHORITY_REQUIRED` with an evidence-bound
proposal, while EXPERT remains command-oriented and provider-independent.

This local evidence is not a pushed tag, GitHub Release or npm publication. A
new publication still requires the exact pushed commit and tag to pass the full
Ubuntu, macOS and Windows native matrix.

## Governed frontier qualification baseline

| Field | Evidence |
| --- | --- |
| Commit | [`a3a4e2941914f14457ed1932ea4024fc495bfff1`](https://github.com/bonushora/surgical-dev-ops/commit/a3a4e2941914f14457ed1932ea4024fc495bfff1) |
| Run | [33110168939](https://github.com/bonushora/surgical-dev-ops/actions/runs/33110168939) |
| Ubuntu, macOS and Windows | PASS |
| Scope | ADR-024-A through ADR-024-I |
| External challenge | [`review/TRY_TO_BREAK_IT.md`](review/TRY_TO_BREAK_IT.md) |

This newer baseline adds bounded streaming, evidence indexing, governed memory,
task-envelope authorization, durable task state, qualified frontier-provider
boundaries, shared experience projection and paired PT-BR/English adversarial
qualification. It does not replace the historical evidence below.

## Canonical green baseline

| Field | Evidence |
| --- | --- |
| Commit | [`36ef01f53690e644976668248499ab9d5031f52f`](https://github.com/bonushora/surgical-dev-ops/commit/36ef01f53690e644976668248499ab9d5031f52f) |
| Workflow | Accelerator Conformance |
| Run | [32808535616](https://github.com/bonushora/surgical-dev-ops/actions/runs/32808535616) |
| Ubuntu job | PASS |
| macOS job | PASS |
| Windows job | PASS |
| Canonical suite | 864 tests discovered; 859 passed; zero failures; 5 explicit platform skips |
| Repository state after qualification | `main` synchronized with `origin/main`; clean worktree |

The workflow does not hide a failing canonical suite. It captures the test
outcome, emits diagnostics on failure, and then enforces a nonzero job result.

## Governed engineering-loop evidence

The v2.5.1 baseline additionally qualifies the single-agent engineering path:

- workspace evidence is obtained only through the governed recursive loop;
- an untrusted model output is materialized as one exact immutable proposal;
- the proposal target and BEFORE SHA-256 must match a governed READ_FILE item;
- malformed shape, authority fields, traversal, stale hashes, oversized content
  and validation broadening fail closed;
- ENGINEER exposes the proposal evidence but performs no implicit mutation;
- the loop terminates at `HUMAN_AUTHORITY_REQUIRED` before the independent R3
  mutation boundary.

The local qualification for commit `36ef01f` discovered 864 tests with 859
passes, zero failures and five platform-specific skips. GitHub Actions run
32808535616 completed successfully across Ubuntu, macOS and Windows.

## Native platform boundaries

### Linux

- Bubblewrap deny-default containment is exercised by the Linux-native contract.
- POSIX filesystem and durability primitives remain behind governed adapters.
- The canonical Ubuntu matrix job passed.

### macOS

- A fixed C helper is built by the macOS job.
- The helper applies a deny-default Seatbelt profile through the native sandbox
  API before executing a closed probe selector.
- Bootstrap, workspace write, workspace boundary, secret read, network, and
  generic process checks remain separated and fail closed.
- The canonical macOS matrix job passed.

### Windows

- A fixed native Win32 helper is built by the Windows job.
- Directory durability and bounded filesystem primitives are qualified without
  exposing a generic shell or caller-selected process interface.
- The canonical Windows matrix job and native diagnostics passed.

These are different native mechanisms. A passing common contract is not a claim
that the operating systems expose identical sandbox semantics.

## Visible red-to-green history

The final result was not produced by skipping the blocking macOS test. Selected
public runs show the investigation:

| Run | Commit | Result | Evidence learned |
| --- | --- | --- | --- |
| [32761138240](https://github.com/bonushora/surgical-dev-ops/actions/runs/32761138240) | `0982533` | macOS failure | Seatbelt test remained blocking while the governed NATURAL grounding change passed. |
| [32769214127](https://github.com/bonushora/surgical-dev-ops/actions/runs/32769214127) | `4d43e24` | macOS failure | Node bootstrap aborted with `SIGABRT` inside Seatbelt. |
| [32770963515](https://github.com/bonushora/surgical-dev-ops/actions/runs/32770963515) | `7eb5a33` | macOS failure | A native helper compiled, but external pre-bootstrap sandboxing still aborted. |
| [32771814195](https://github.com/bonushora/surgical-dev-ops/actions/runs/32771814195) | `eb6c4c6` | macOS failure | Isolated probes identified the exact failing stage as `bootstrap`. |
| [32772955351](https://github.com/bonushora/surgical-dev-ops/actions/runs/32772955351) | `8763198` | PASS | Native self-application of Seatbelt passed on macOS while Linux and Windows stayed green. |
| [32808535616](https://github.com/bonushora/surgical-dev-ops/actions/runs/32808535616) | `36ef01f` | PASS | Single-agent governed engineering loop passed while the three native platform jobs remained green. |

The blocking test was retained throughout. The final green run used the same
canonical workflow and three-platform matrix.

## Reproduction

From a clean checkout with the declared Node.js runtime:

```bash
npm ci
npm test
```

GitHub Actions additionally builds the qualified Windows and macOS native
helpers before running the canonical suite on their respective platforms.

## Explicit limitations

- CI success is evidence for covered contracts in the observed runner
  environments; it is not proof of absolute security.
- External adversarial review is invited under ADR-025 but has not yet been
  completed independently.
- Physical power-loss qualification is not claimed.
- `POWER_LOSS_VALIDATED` remains false.
- Strict Physical Identity-Conditional CAS at the pathname boundary remains
  unqualified as documented by ADR-009.
- A process-crash/restart test is not represented as universal storage
  durability under sudden power loss.
- The cognitive model remains probabilistic and may be wrong; operational
  authority remains outside the model.
