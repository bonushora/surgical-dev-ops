# External Engineering Review Package — Surgical DevOps

## Current ADR-025 review baseline

| Item | Evidence |
| --- | --- |
| Source baseline | `b82a845a3f30d44c8073cdda8a1354a286ce1ae4` |
| Canonical workflow run | `33034046356` |
| Matrix | Ubuntu, macOS and Windows: PASS |
| Governed frontier milestones | ADR-024-A through ADR-024-I: qualified |
| Review challenge | [`review/TRY_TO_BREAK_IT.md`](review/TRY_TO_BREAK_IT.md) |
| Machine-readable manifest | [`review/QUALIFICATION_MANIFEST.json`](review/QUALIFICATION_MANIFEST.json) |

This is an invitation to independent review, not a claim that an independent
audit has already occurred. The historical v2.5.1 baseline remains below so its
earlier evidence is not rewritten.

## Historical v2.5.1 package

## Review objective

Evaluate whether probabilistic cognitive output remains outside the operational
authority boundary while Surgical DevOps admits, observes, proposes and mutates
through explicit deterministic contracts.

The review target is not the accuracy of a language model. The target is the
authority separation around it.

### Canonical baseline

| Item | Evidence |
| --- | --- |
| Pre-release implementation commit | `36ef01f53690e644976668248499ab9d5031f52f` |
| Canonical workflow run | `32808535616` |
| Matrix | Ubuntu, macOS and Windows: PASS |
| Suite | 864 discovered; 859 PASS; 0 FAIL; 5 platform SKIP |
| Protocol core | BH-SEP v2.2 and BH-SDP v2.2 |

The final v2.5.1 release commit and tag must be recorded only after the release
patch passes the same canonical matrix.

## Fast reproduction

Requirements: a clean checkout and Node.js `>=24.18.0`.

```bash
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

The demo is deterministic and requires no AI provider. Its expected terminal
state is:

```text
status: HUMAN_AUTHORITY_REQUIRED
evidenceCount: 2
operationalAuthority: false
mutationAuthority: false
approvalAuthority: false
```

It does not write a file, issue a capability grant, create human approval or
dispatch the production mutation provider.

## Authority flow under review

```text
Human objective
  -> explicit evidence authorization
  -> bounded recursive evidence requests
  -> canonical Orchestrator R0 dispatch
  -> immutable governed evidence
  -> untrusted cognitive proposal
  -> strict proposal materialization
  -> target + BEFORE SHA-256 binding
  -> HUMAN_AUTHORITY_REQUIRED
  -> separate explicit R3 command
  -> identity + risk + capability + CAS + journal + recovery
```

The first flow cannot silently become the second. The model, adapter and
engineering loop all carry zero approval and mutation authority.

## High-value adversarial cases

| Attack or failure | Expected behavior | Primary evidence |
| --- | --- | --- |
| Model adds an authority field | Reject exact proposal shape | `governed-engineering-proposal.test.js` |
| Absolute path or traversal | Reject before proposal admission | `governed-engineering-proposal.test.js` |
| Stale or substituted BEFORE hash | Reject evidence binding | `governed-engineering-agent-loop.test.js` |
| Evidence planner fails | No proposal call and no continuation | `governed-engineering-agent-loop.test.js` |
| Model responds without evidence | Fail closed | `natural-cli-async-session.test.js` |
| Conversational approval | Authorizes bounded evidence only | `natural-session-control.test.js` |
| Provider unavailable | Deterministic fallback; no mutation | `natural-cognitive-session.test.js` |
| R1/R2 mutation attempt | Zero physical dispatch | Orchestrator and capability tests |
| Replay or conflicting successor | Idempotent success or fail closed | journal, CAS and restart tests |
| Native sandbox failure | Platform job fails | canonical Actions workflow |

## Trust-boundary inspection

Review these modules in order:

1. `accelerator/core/ai-provider.js`
2. `accelerator/core/governed-ai-runtime.js`
3. `accelerator/cli/natural-recursive-evidence-loop.js`
4. `accelerator/core/governed-engineering-proposal.js`
5. `accelerator/cli/governed-engineering-agent-loop.js`
6. `accelerator/core/surgical-orchestrator.js`
7. `accelerator/cli/governed-patch-dispatch.js`
8. `accelerator/core/production-mutation-runtime.js`

## Claims supported by the current baseline

- The cognitive provider is not a mutation provider.
- AI output cannot directly create operational authority.
- Project claims in the governed NATURAL analysis path require workspace
  evidence.
- An ENGINEER patch proposal must bind to one observed file and BEFORE hash.
- The proposal flow stops before R3 authority and physical mutation.
- The production mutation path preserves explicit identity, risk, exact scope,
  Manifest CAS, journal, durability, replay and recovery contracts.
- The canonical suite passes on GitHub-hosted Linux, macOS and Windows runners.

## Explicit non-claims

- A language model is not made deterministic.
- CI is not mathematical proof or an external security audit.
- Universal physical power-loss safety is not claimed.
- `POWER_LOSS_VALIDATED` remains false.
- Strict Physical Identity-Conditional CAS for ordinary pathname mutation
  remains unqualified under ADR-009.
- Multi-agent coordination is not part of this release baseline.
- Remote commercial providers are optional and not automatically qualified.

## Reviewer output requested

Please report:

1. an invariant that can be bypassed;
2. the smallest reproducible input and observed result;
3. whether the issue creates authority, leaks scope, mutates state or only
   affects presentation;
4. the affected platform and runtime;
5. whether the failure is deterministic and repeatable.

Do not include live credentials, private keys or production secrets in a
report.
