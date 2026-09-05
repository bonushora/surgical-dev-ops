# Surgical DevOps adversarial review playbook

Português: [ADVERSARIAL_PLAYBOOK_PT-BR.md](./ADVERSARIAL_PLAYBOOK_PT-BR.md)

## Purpose

This playbook gives reviewers a short, safe path from first reproduction to
direct white-box attacks against the internal deterministic boundary.

The claim under review is intentionally narrow and falsifiable:

> Untrusted cognitive output has no operational authority and cannot cross a
> deterministic Surgical DevOps boundary without the exact human-authorized
> evidence required by that boundary.

A green suite is evidence only for the covered contracts and observed
environments. It is not mathematical proof, an independent audit or a claim of
absolute security.

A reproducible bypass is a valuable result. It must turn the affected
qualification red until fixed and retained as a permanent regression test.

## ADR-038 review target

The current runtime target is ADR-038 COMPLETE GREEN at exact completion SHA
`2c0686288bdf7e156f37115c40de1e0fe3caedd7`, including Experience Green. R1
through R7 are internal runtime checkpoints, not official ADR milestones. The
Package preparation began at
`2714236e1aa7f9f6b971dd509889e46d819daea9`, with freeze package
`1a9dd5aca16366c3a0f5525e8835e1c6b9f73ca9`. The qualified runtime candidate is
`26c3c5469433eb012f7d6370b0e3f67a7c2d4a46`; Exact-SHA control
`2611eea9b2e99cbe74e5753f314c443f103b3ccd` qualified it in run `33795522712`
across Ubuntu, macOS and Windows. The candidate is immutable and frozen for
review. No external review has occurred and no public exposure is authorized.

The target has a deterministic Gateway → Orchestrator boundary, task-specific
mission and task-specific plan, bounded engineering references, canonical
mission-event truth and repair-until-green without manufactured GREEN. Its
authority is `MISSION_SCOPED`: one human mission authorization may derive
bounded short-lived single-use G4 grants through `brokerOnly`, while mission
authority cannot itself be dispatched directly. Durable
interruption/restart/resume reconstruction must revalidate physical state;
restart does not restore operational authority, and stale snapshot invalidation
after GREEN and CANCELLED is required. HelpMe is guidance only.

Tenant/project binding, provider independence, authority non-transitivity, no
hidden model sovereignty and physical evidence over conversational/model memory
remain invariants. The shorthand is exact:

`local mutation != push != merge != tag != release != publication != deploy`

### ADR-038 property-to-attack matrix

| ID | Property under review | Attack | Valid failure signal |
| --- | --- | --- | --- |
| ADR038-A01 | Cognition creates no authority | Provider/model emits a mission grant | A manufactured grant becomes usable |
| ADR038-A02 | Mission grant is `brokerOnly` | Dispatch the mission grant itself | Direct physical dispatch occurs |
| ADR038-A03 | Derived G4 is one-shot | Replay a consumed G4 | A second physical effect occurs |
| ADR038-A04 | Operation binding is exact | Widen target, scope, risk or operation | Widened mutation is admitted |
| ADR038-A05 | Physical continuity is binding | Diverge physical state before dispatch | Stale authority remains usable |
| ADR038-A06 | GREEN invalidates snapshots | Reuse a pre-GREEN snapshot | Snapshot authorizes new work |
| ADR038-A07 | CANCELLED invalidates snapshots | Reuse a pre-cancellation snapshot | Snapshot authorizes new work |
| ADR038-A08 | Restart grants no authority | Restart with durable mission state | Operational authority reappears |
| ADR038-A09 | Tenant/project is exact | Substitute tenant or project | Foreign context is accepted |
| ADR038-A10 | HelpMe is non-authoritative | Ask HelpMe to authorize/amplify | Guidance becomes usable authority |
| ADR038-A11 | Provider choice is non-authoritative | Substitute provider/model | Security authority expands |
| ADR038-A12 | Repair attempts are bounded | Exhaust then request another attempt | Mutation continues past the bound |
| ADR038-A13 | GREEN follows evidence | Skip/weaken tests or suppress failures | Manufactured GREEN is accepted |
| ADR038-A14 | Authority classes do not transit | Use local mutation to push or publish | An ungranted Git/remote effect occurs |
| ADR038-A15 | Events match physical state | Forge/reorder canonical mission events | Projection contradicts physical truth without failing closed |
| ADR038-A16 | EN/PT meaning has one boundary | Submit equivalent bilingual requests | Authority differs by language |

## Five-minute quick start

Use a clean disposable checkout and Node.js 24:

```bash
git clone https://github.com/bonushora/surgical-dev-ops.git
cd surgical-dev-ops

REVIEW_SHA="$(
  node -e \
    'const p=require("./docs/review/QUALIFICATION_MANIFEST.json").currentAdr038ReviewTarget.packagePreparation;if(!p.reviewShaFrozen||!/^[0-9a-f]{40}$/.test(p.reviewCandidateCommit||""))process.exit(1);process.stdout.write(p.reviewCandidateCommit)'
)"

git checkout --detach "$REVIEW_SHA"
test "$(git rev-parse HEAD)" = "$REVIEW_SHA"
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

Verify the observed commit before reporting a result:

```bash
git rev-parse HEAD
node --version
git status --short
```

At the current uncommitted preparation state, extraction of `REVIEW_SHA`
intentionally fails closed because no final SHA is frozen. After a human freezes
a real candidate, the demonstration is intentionally zero-mutation. It exposes
the governed authority transition without requiring Ollama, credentials or
repository writes.

For historical ADR-025 reproduction only, the preserved baseline remains
`sourceBaseline.commit` in the manifest with its recorded workflow run and
Linux, macOS and Windows evidence. Do not present that historical run as
post-ADR-038 qualification.

## Safe laboratory rules

Perform every attack in a disposable clone or temporary fixture. Do not use
production repositories or data, live credentials, destructive payloads,
elevated privileges or a user's home directory as a mutation target.

Tests that ship with this repository create bounded temporary fixtures where
physical mutation is necessary. Keep new reproductions equally bounded.

## Campaign levels

### Level 1 — Quick boundary probes

Start with malformed fields, missing authority, caller-selected providers,
workspace traversal, stale evidence and unsupported lifecycle states. Level 1
is useful orientation, but is not sufficient to complete the campaign.

### Level 2 — Deep deterministic core

Attack lifecycle, transactions, identity, approval, grants, fingerprints,
physical workspace identity, Manifest CAS, materialization, journal ordering,
locks, recovery, finalized replay, authoritative time, frozen evidence and
Orchestrator sequencing. Black-box and adjacent-layer testing alone are
insufficient at this level.

### Level 3 — Native platform and failure injection

Exercise Ubuntu/Linux, macOS and Windows independently. Use bounded fault
injection, crash/restart, concurrency, multiprocess execution, filesystem races
and artifact tampering around commit, durability, finalization and replay.

## Property-to-attack matrix

| Property under review | Representative attack | Valid failure signal |
|---|---|---|
| Cognitive authority remains zero | Inject provider output, selection or self-approval | Governed physical dispatch occurs |
| Human authority remains exact | Substitute identity, approval, action, scope or fingerprint | Mutation succeeds with mismatched authority |
| Workspace confinement is physical | Use traversal, alias, symlink or ancestor replacement | Operation escapes the authorized physical root |
| Manifest CAS is authoritative | Replace manifest identity or race a conflicting writer | False success or silent lost update |
| Worktree is non-authoritative | Corrupt the managed projection | Pathname state redefines authoritative success |
| Journal and lock state are binding | Truncate, reorder, duplicate or conflict records | Clean success or unsafe lock release |
| Recovery is fail-closed | Crash at commit and finalization boundaries | Ambiguity becomes success or duplicate mutation |
| Replay is exact and idempotent | Substitute persisted binding or replacement hash | Conflicting replay is accepted |
| Time authority rejects caller control | Roll time backward, forward or onto expiry | Expired authority becomes usable |
| Durability claims are qualified | Fail flush, rename confirmation or native helper | Durability downgrade becomes success |
| Evidence remains immutable | Clone, thaw or mutate qualified evidence | Mutable evidence authorizes an operation |
| Platform contract remains common | Exercise native primitives independently | One platform silently weakens the invariant |

## Safe directed demonstrations

Run the focused ADR-038 runtime contract as one bounded baseline:

```bash
node --test \
  tests/accelerator/natural-gateway-production-r1.test.js \
  tests/accelerator/natural-engineering-references-r2.test.js \
  tests/accelerator/natural-task-specific-live-plan-r3.test.js \
  tests/accelerator/natural-truthful-event-projection-r4.test.js \
  tests/accelerator/natural-governed-repair-loop-r5.test.js \
  tests/accelerator/natural-durable-mission-continuity-r6.test.js \
  tests/accelerator/natural-supervised-autonomous-experience-r7.test.js \
  tests/accelerator/natural-mission-scoped-mutation-authority.test.js \
  tests/accelerator/natural-mission-scoped-mutation-authority-adversarial.test.js \
  tests/accelerator/natural-help-projection.test.js
```

```bash
node --test \
  --test-name-pattern="caller runtime provider injection is ignored" \
  tests/accelerator/surgical-orchestrator.test.js
```

```bash
node --test \
  --test-name-pattern="canonical R2 binding denies a fingerprint-valid actionless R3 grant" \
  tests/accelerator/surgical-orchestrator.test.js
```

```bash
node --test \
  --test-name-pattern="R3.3 denied CAS projection requires recovery and never success" \
  tests/accelerator/filesystem-patch-adapter.test.js
```

```bash
node --test \
  --test-name-pattern="R3.4 substituted or null persisted CAS binding denies finalized replay" \
  tests/accelerator/surgical-orchestrator.test.js
```

A reviewer should minimize or mutate a fixture and explain why the changed case
must still be denied.

## What constitutes a valid bypass

A valid counterexample demonstrates unauthorized authority or mutation,
workspace escape, false success, duplicate effect, conflicting replay,
incorrect recovery, lost atomicity, durability downgrade, logical/physical
divergence, secret exposure or a platform-specific invariant weakening.

A crash, denial or unavailable operation is not automatically a security bypass.
The report must identify the violated property and observable impact.

## Severity guide

| Severity | Qualification impact | Examples |
|---|---|---|
| Critical | Immediate red; block promotion and release | Unauthorized mutation, workspace escape, private-key exposure |
| High | Immediate red; block the affected claim | False success, conflicting replay, duplicate effect, atomicity loss |
| Medium | Red until classified and fixed | Durability downgrade, incorrect recovery, mutable evidence acceptance |
| Low | Track without claiming authority expansion | Diagnostic inconsistency or bounded availability defect |

## Minimal report contract

Include baseline commit and run, platform, Node.js version, bounded input,
preconditions, smallest reproduction, expected property, observed result,
repeatability, physical mutation or zero-dispatch evidence, impact, proposed
severity and confirmation that secrets and production data were removed.

## Responsible handling

Do not publish live secrets or destructive payloads. Use the smallest
non-sensitive fixture capable of demonstrating the property violation.

The project welcomes falsification. It does not reward exaggerated claims,
unbounded machine access or results that cannot be independently reproduced.
