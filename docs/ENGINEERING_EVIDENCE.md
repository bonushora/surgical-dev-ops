# Engineering Evidence Trail

## Purpose

This document records reproducible evidence for the current Surgical DevOps
multiplatform baseline. It distinguishes observed results from broader security
claims that remain unqualified.

## Governed frontier qualification baseline

| Field | Evidence |
| --- | --- |
| Commit | [`7cf628899e69c90078815ebb959f0bd97c077526`](https://github.com/bonushora/surgical-dev-ops/commit/7cf628899e69c90078815ebb959f0bd97c077526) |
| Run | [32956401106](https://github.com/bonushora/surgical-dev-ops/actions/runs/32956401106) |
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
