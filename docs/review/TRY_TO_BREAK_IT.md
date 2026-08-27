# Try to Break the Deterministic Boundary

Português: [TRY_TO_BREAK_IT_PT-BR.md](./TRY_TO_BREAK_IT_PT-BR.md)

## Falsifiable claim

This release presents one narrow, falsifiable claim: untrusted cognitive output
has no operational authority and cannot cross a deterministic Surgical DevOps
boundary without the exact human-authorized evidence required by that boundary.

Do not trust the test count or this statement by itself. Inspect the threat model,
reproduce the baseline and attack the internal implementation directly. The goal
is not to confirm the claim; it is to find the smallest reproducible counterexample.

A reproducible bypass is a valuable result. It must turn the affected qualification
red until the defect is fixed and the counterexample becomes a permanent regression
test.

## Start here

Use the [adversarial review playbook](./ADVERSARIAL_PLAYBOOK.md) for the
five-minute quick start, safe laboratory rules, three campaign levels,
property-to-attack matrix, directed demonstrations, severity guide and
minimal report contract.

## Reproduce the baseline

Use a clean checkout of commit
`a3a4e2941914f14457ed1932ea4024fc495bfff1` with Node.js `24.18.0`:

```bash
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

The corresponding canonical workflow is
[run 33110168939](https://github.com/bonushora/surgical-dev-ops/actions/runs/33110168939),
which passed on Ubuntu, macOS and Windows.

## High-value targets

Try to demonstrate one of these outcomes with the smallest reproducible input:

- provider output creates or widens operational authority;
- an absolute path, traversal or alias escapes the physical workspace;
- a credential crosses into prompts, evidence, logs, memory or telemetry;
- stale evidence, cached content or remembered approval becomes current authority;
- interrupted or partial streaming output is accepted as a completed operation;
- a stopped/restarted task duplicates a committed physical effect;
- PT-BR and English requests with equivalent meaning cross different boundaries;
- Linux, macOS or Windows silently weakens the common contract;
- malformed provider data becomes a shell, process, filesystem or mutation action;
- journal, lock, CAS or recovery ambiguity becomes clean success.

## Mandatory deep white-box campaign

Do not stop at the CLI, API, provider boundary or other adjacent layers.
Black-box and boundary-only testing are insufficient for this campaign.

Attack the internal deterministic core directly. In particular, try to:

- mutate lifecycle and transaction states after validation;
- substitute identity, approval, grant, action, scope or fingerprints;
- desynchronize physical workspace identity from its lexical representation;
- replace before/after Manifest CAS identities or corrupt managed materialization;
- truncate, duplicate, reorder or conflict journal records;
- crash or restart between every commit, durability and finalization boundary;
- race writers, replace ancestors and reopen the same operation concurrently;
- roll authoritative time backward, forward or exactly onto expiry;
- alter frozen or persisted evidence after qualification;
- make a finalized replay accept a null, mutable, substituted or foreign
  workspace/CAS binding;
- make provider-reported `APPLIED` become success without canonical evidence;
- make cognitive output gain filesystem, Git, process, shell, network,
  credential or mutation authority.

Use white-box review, fault injection, mutation testing, structured fuzzing,
property-based tests, concurrency, multiprocess execution, crash/restart and
direct artifact tampering. Exercise native Linux, macOS and Windows behavior
for platform-dependent claims.

The campaign is incomplete unless it attempts false success, unauthorized mutation, atomicity loss, conflicting replay acceptance, false recovery, durability downgrade, and logical/physical divergence through attacks on the internal implementation itself.

## A valid report

Include the baseline commit, platform, Node.js version, exact input, expected
boundary, observed result, repeatability and impact. Use the GitHub adversarial
report form. Do not submit live credentials, private keys, production data or
unrelated personal information.

## What success and failure mean

A green suite demonstrates only the covered contracts in the observed runner
environments. It is not mathematical proof or an independent audit. A real bypass
is a valuable outcome: it should turn the affected qualification red until fixed.
