# Surgical DevOps adversarial review playbook

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

## Five-minute quick start

Use a clean disposable checkout and Node.js 24:

```bash
git clone https://github.com/bonushora/surgical-dev-ops.git
cd surgical-dev-ops

BASELINE="$(
  node -p \
    "require('./docs/review/QUALIFICATION_MANIFEST.json').sourceBaseline.commit"
)"

git checkout --detach "$BASELINE"
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

The demonstration is intentionally zero-mutation. It exposes the governed
authority transition without requiring Ollama, credentials or repository
writes.

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
