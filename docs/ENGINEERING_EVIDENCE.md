# Engineering Evidence Trail

## Purpose

This document records reproducible evidence for the current Surgical DevOps
multiplatform baseline. It distinguishes observed results from broader security
claims that remain unqualified.

## Canonical green baseline

| Field | Evidence |
| --- | --- |
| Commit | [`8763198993711066e2a2e01b40aa87533ef4f019`](https://github.com/bonushora/surgical-dev-ops/commit/8763198993711066e2a2e01b40aa87533ef4f019) |
| Workflow | Accelerator Conformance |
| Run | [32772955351](https://github.com/bonushora/surgical-dev-ops/actions/runs/32772955351) |
| Ubuntu job | PASS |
| macOS job | PASS |
| Windows job | PASS |
| Canonical suite | 849 tests discovered; zero failures at the accepted baseline |
| Repository state after qualification | `main` synchronized with `origin/main`; clean worktree |

The workflow does not hide a failing canonical suite. It captures the test
outcome, emits diagnostics on failure, and then enforces a nonzero job result.

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
- External adversarial review has not yet been completed.
- Physical power-loss qualification is not claimed.
- `POWER_LOSS_VALIDATED` remains false.
- Strict Physical Identity-Conditional CAS at the pathname boundary remains
  unqualified as documented by ADR-009.
- A process-crash/restart test is not represented as universal storage
  durability under sudden power loss.
- The cognitive model remains probabilistic and may be wrong; operational
  authority remains outside the model.
