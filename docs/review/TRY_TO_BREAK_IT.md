# Try to Break the Deterministic Boundary

The challenge is simple: make untrusted cognitive output cross a deterministic
Surgical DevOps authority boundary that it should not cross.

## Reproduce the baseline

Use a clean checkout of commit
`7cf628899e69c90078815ebb959f0bd97c077526` with Node.js `24.18.0`:

```bash
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

The corresponding canonical workflow is
[run 32956401106](https://github.com/bonushora/surgical-dev-ops/actions/runs/32956401106),
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

## A valid report

Include the baseline commit, platform, Node.js version, exact input, expected
boundary, observed result, repeatability and impact. Use the GitHub adversarial
report form. Do not submit live credentials, private keys, production data or
unrelated personal information.

## What success and failure mean

A green suite demonstrates only the covered contracts in the observed runner
environments. It is not mathematical proof or an independent audit. A real bypass
is a valuable outcome: it should turn the affected qualification red until fixed.
