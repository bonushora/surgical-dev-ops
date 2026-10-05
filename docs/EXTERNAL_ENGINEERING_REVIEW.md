# External Engineering Review Package — Surgical DevOps

## EER-1 current review-evidence policy

The current review package uses `RUNTIME_EXACT_SHA_EVIDENCE`. A Git commit
cannot contain its own not-yet-known SHA as authoritative evidence. Therefore
the checked-in manifest defines stable claims, historical evidence, policy and
the `sdo.qualification_evidence.v1` runtime schema; it deliberately stores no
future EER-1 candidate SHA or run ID. The authoritative final binding is
produced by the canonical workflow from the requested full SHA, the checked-out
SHA and `GITHUB_SHA` at execution time.

The final evidence identity is the external tuple:

`FINAL_EER1_GIT_SHA + EXACT_REF_RUN_ID + RETAINED_MACHINE_READABLE_PLATFORM_EVIDENCE`

Do not commit the run ID, artifact IDs or final SHA back into the qualified
candidate. That would create a different, unqualified commit. GitHub artifact
retention is bounded, currently configured for 30 days, and is not permanent
archival storage.

### Physically verified pre-EER1 historical baseline

Commit `24f0f1946eb795b3464b2846953e191755b9c8c3` passed the canonical Linux,
macOS and Windows matrix in exact-ref run `34860826996` on Node.js `24.18.0`.
Run `34862373028` is a separate successful `push` run for `main` at the same
commit. Both are historical baseline evidence only. Each currently has zero
retained artifacts, and neither retained the canonical test totals in a
machine-readable artifact. Neither run can qualify a later EER-1 commit.

### Review status and non-claims

An independent external security and architecture review has been performed by
Boris Abuzov and is considered substantially complete at the current agreed
depth of review. Two previously identified qualification points remain open.
The review produced architecture questions that led to concrete hardening and
additional qualification work.

This review is not a universal security certification, formal audit opinion or
claim that all defects or attack paths have been identified. The final review
SHA is not frozen by this repository content. Release, merge, publication and
public exposure are not authorized. CI is not proof of absolute security.
Physical sudden-power-loss safety and strict pathname physical-identity CAS
remain unqualified. Linux, macOS and Windows use different native isolation
mechanisms; qualification does not claim those primitives are identical.

The review contribution is formally acknowledged in
[`review/EXTERNAL_REVIEW_ACKNOWLEDGEMENTS.md`](review/EXTERNAL_REVIEW_ACKNOWLEDGEMENTS.md).

### Reproduction and exact identity verification

Use Git `>=2.30`, Node.js `>=24.18.0` and the lockfile install. `npm ci` requires
network access to the configured npm registry when dependencies are not already
available. The local canonical path needs no AI provider or provider credential:

```bash
git rev-parse HEAD
node --version
npm ci
npm test
npm pack --dry-run --json
```

For native CI, Linux additionally installs and attests AppArmor/Bubblewrap and
builds the fixed C relay; macOS uses `/usr/bin/clang` and the system Seatbelt
library; Windows requires Visual Studio C++ build tools discoverable through
`vswhere.exe`. The canonical hosted workflow supplies these prerequisites.

After an authorized exact-ref run, retrieve the three artifacts without writing
to this repository:

```bash
gh run download EXACT_REF_RUN_ID \
  --repo bonushora/surgical-dev-ops \
  --pattern 'qualification-evidence-*' \
  --dir /tmp/sdo-eer1-evidence
```

For every JSON file, verify the supported schema, run ID, platform, Node
version, canonical command and internally consistent totals. The requested ref,
expected target SHA, checked-out SHA and `GITHUB_SHA` must all equal the full
candidate SHA; `canonicalTest.exitCode` must be `0`, `canonicalTest.result` must
be `PASS`, `externalReviewCompleted` must be `false`, and `releaseAuthorized`
must be `false`. Cross-check the run ID, event, head SHA, attempt and each native
job conclusion against GitHub Actions metadata rather than trusting the artifact
alone.

### Historical ADR-038 package evidence

The earlier package described the complete ADR-038 supervised autonomous
engineering runtime at `2c0686288bdf7e156f37115c40de1e0fe3caedd7`, including
Experience Green. R1 through R7 were internal runtime checkpoints, not official
ADR milestones. Its later package and qualification SHAs and run remain in the
manifest under `historicalAdr038ReviewTarget`; they are not current EER-1
evidence.

### Runtime boundary under review

The deterministic Gateway → Orchestrator authority boundary admits a
task-specific mission and task-specific plan, bounded engineering references
and canonical mission-event truth. The runtime may investigate, locally edit,
test and use repair-until-green within a valid mission, but it cannot obtain a
result by manufactured GREEN, weakened tests or suppressed physical evidence.

The current authority contract is:

- the human authorizes a mission-scoped envelope identified as
  `MISSION_SCOPED`;
- one human mission authorization may derive bounded short-lived single-use G4
  mutation grants;
- the mission grant is `brokerOnly`, and mission authority cannot itself be
  dispatched directly;
- every derived operation remains bound to objective, operation, target, scope,
  risk, tenant/project binding, physical baseline, state and applicable CAS;
- a used G4 cannot be reused, and no target, scope, risk or operation may be
  widened;
- physical divergence invalidates stale mission authority;
- stale snapshot invalidation after GREEN and CANCELLED is mandatory;
- durable interruption/restart/resume reconstruction revalidates physical
  continuity, and restart does not restore operational authority;
- HelpMe is guidance only, never authority creation or amplification;
- provider independence is preserved: substitution cannot expand security
  authority, and there is no hidden model sovereignty;
- authority non-transitivity is explicit:
  `local mutation != push != merge != tag != release != publication != deploy`.

Canonical events and fresh physical state decide whether a transition or effect
occurred. The event stream must not diverge from the filesystem, Git state,
mission journal or CAS. Plans, summaries, provider output and conversation are
not substitutes for exact physical evidence over conversational/model memory.
Repair attempts are bounded and evidence-driven; exhaustion, ambiguity or lack
of progress fails closed instead of manufacturing GREEN.

### Current non-claims and next boundary

The current external review is substantially complete at its agreed depth, with
two previously identified qualification points still remaining. This package
makes no absolute-security claim and does not promote the review into a
certification or formal audit opinion.

It does not claim that the final review SHA is frozen or that public exposure
is authorized. Local mutation grants no Git or remote authority. The composed
candidate must be requalified by exact SHA before a human separately freezes
it as the review candidate. Public exposure remains a later, separately
authorized operation under the frozen external-review gate.

## Review evidence index

This index is a navigation map, not a substitute for reading the normative
source or reproducing the test and CI evidence.

| Claim | Normative source | Implementation | Test | CI evidence | Limitation / non-claim |
| --- | --- | --- | --- | --- | --- |
| Human sovereignty | ADR-006; BH-SEP v2.3 | `accelerator/core/human-identity-assertion.js` and Orchestrator admission | `human-identity-assertion.test.js`; `local-offline-human-authority.test.js` | Canonical suite plus exact-SHA platform artifact | A passing test does not create human authority. |
| Intelligence != authority | ADR-004; ADR-014 | `accelerator/core/ai-provider.js`; `accelerator/core/governed-ai-runtime.js` | `ai-provider.test.js`; `governed-ai-runtime.test.js` | Same exact-SHA artifacts | Model quality and model determinism are not claimed. |
| Mediated mutation | ADR-007; ADR-013 | `accelerator/core/production-mutation-runtime.js`; `accelerator/cli/governed-patch-dispatch.js` | `production-mutation-runtime.test.js`; `mutation-provider.test.js` | Same exact-SHA artifacts | Local mutation does not grant Git or remote authority. |
| Fail-closed and no silent fallback | ADR-004; ADR-022 | Orchestrator, provider selection and containment adapters | `surgical-orchestrator.test.js`; `codex-provider-only-transport.test.js` | Same exact-SHA artifacts | Availability failure is not silently promoted to success. |
| Bounded Git authority | ADR-038 | governed Git read and mission authority composition | `git-read-adapter.test.js`; `natural-mission-scoped-mutation-authority-adversarial.test.js` | Same exact-SHA artifacts | Commit != push != merge != tag != release. |
| Manifest CAS | ADR-010 | `accelerator/core/git-manifest-materializer.js` and mutation adapters | `git-manifest-cas.test.js`; `git-manifest-materializer.test.js` | Same exact-SHA artifacts | Strict ordinary-pathname physical-identity CAS remains unqualified. |
| Journal/recovery | ADR-007; ADR-008 | mutation journal, recovery and durability adapters | `mutation-journal-adapter.test.js`; `mutation-recovery.test.js`; native durability tests | Same exact-SHA artifacts | Sudden physical power-loss safety is not claimed. |
| Filesystem/workspace confinement | ADR-009; ADR-010 | workspace-boundary and filesystem-safe adapters | `workspace-boundary-platform.test.js`; `authority-physical-workspace-platform.test.js` | Same exact-SHA artifacts | Native isolation primitives are not claimed identical. |
| Provider containment | ADR-012; ADR-022 | provider-only transport and native containment | `codex-cognitive-containment.test.js`; `ollama-local-transport.test.js` | Same exact-SHA artifacts | Provider substitution does not inherit qualification automatically. |
| Exact-ref qualification tied to exact Git state | ADR-025; ADR-038 | canonical workflow and `accelerator/ci/qualification-evidence.js` | `exact-ref-ci-contract.test.js`; `qualification-evidence.test.js` | One retained artifact per Linux/macOS/Windows job | The pre-EER1 run had no retained artifacts; final proof must come from the final candidate run. |
| Cross-platform normative invariants | ADR-008; ADR-038 | Linux Bubblewrap, macOS Seatbelt and Windows native helpers | platform-specific adapter and workflow tests | Three successful native jobs and three consistent artifacts | Common invariants do not mean identical OS mechanisms. |
| Non-transitive mission authority | ADR-038 | mission runner and governed authorization consumption | `mission-runner-policy-v23.test.js`; `natural-development-authorization-consumption.test.js` | Same exact-SHA artifacts | Review, release and publication remain separate human decisions. |

ADR-019 still says `IMPLEMENTED / CI QUALIFICATION REQUIRED`. Existing exact-ref
history supplies relevant CI evidence, but this status text is retained as ADR
history because repository policy does not clearly authorize EER-1 to revise the
decision record. The discrepancy is review metadata, not a rewritten ADR status.

## Historical ADR-025 review baseline

| Item | Evidence |
| --- | --- |
| Local integrated NATURAL gateway qualification | ADR-036 + ADR-037 on `release/v2.6.0-rc.6` |
| NATURAL default checkpoint | `9ed86a443da18f923b60692d7446f1fd57d0a2da` |
| Local suite | 1212 discovered; 1207 PASS; 0 FAIL; 5 platform SKIP |
| Final manual acceptance | **GREEN** at tested checkpoint `c151aee95d4639209942b6ed27fb25a1d76df8ff` |
| Historical second-counterexample checkpoint | `13093b76a51d0fbf2886cdf00bef68e3547d75c4`: 1210 discovered; 1205 PASS; 0 FAIL; 5 platform SKIP |
| Historical first-counterexample checkpoint | `38904d79b61436a23b44eb2432a049415bb30795`: 1209 discovered; 1204 PASS; 0 FAIL; 5 platform SKIP |
| Historical semantic-routing checkpoint | `4a901069accf4c57f3bbb2f4a46dae26cdee2561`: 1206 discovered; 1201 PASS; 0 FAIL; 5 platform SKIP |
| Local governed workspace checkpoint | `f56750eba3aa07b0426f56021c072a280468ea98` |
| ADR-034 implementation start | `2f8d9e1aa40d0d7a127e966a28e475e0f89c4bb0` |
| Source baseline | `a3a4e2941914f14457ed1932ea4024fc495bfff1` |
| Canonical workflow run | `33110168939` |
| Matrix | Ubuntu, macOS and Windows: PASS |
| Governed frontier milestones | ADR-024-A through ADR-024-I: qualified |
| Review challenge | [`review/TRY_TO_BREAK_IT.md`](review/TRY_TO_BREAK_IT.md) |
| Machine-readable manifest | [`review/QUALIFICATION_MANIFEST.json`](review/QUALIFICATION_MANIFEST.json) |

That historical local implementation added the ADR-036 persistent NATURAL governed
mission and the ADR-037 Integrated Governed Agent Gateway to the existing
ADR-034 deterministic workspace experience. The model still does not receive
direct filesystem, shell, Git, mutation, network, release or publish authority;
structured requests cross Surgical mediation and known tools can still be
denied. This is an invitation to independent review, not a claim that an
independent audit has already occurred. The historical v2.5.1 baseline remains
below so its earlier evidence is not rewritten.

That historical local suite also covered the manual counterexample in which governed
project evidence was acquired but lacked an explicit relationship in the
serialized cognitive context. The regression inspects the real provider
envelope, verifies the nonzero evidence count and normalized content, and keeps
provider failure after acquisition distinct from zero acquired evidence. Human
manual acceptance still requires re-test.

The second manual counterexample preserved that handoff but exposed an
incompatible local execution budget: the qualified 2,358-token project-analysis
input had processed only 2,048 tokens at the 59.997-second cancellation point.
The deterministic workload regression establishes an optimistic 84,078 ms
lower bound including the existing PLAN output budget. The default CPU profile
therefore restores its previously qualified bounded 180-second deadline. The
provider, payload, context ceiling, no-thinking behavior, authority and
fail-closed timeout semantics remain unchanged; human acceptance again requires
re-test.

The third manual counterexample showed that a natural mission-cancellation
request bypassed deterministic session control, reached provider cognition and
produced an operational success claim while `/status` remained `PLANNING`. The
repair reuses the existing terminal `CANCELLED` state and `MISSION_CANCELLED`
event before provider fallback. The regression proves zero provider calls,
state-backed status, cleared pending authority and terminal resume refusal. No
new lifecycle, tool, provider or authority class was added; human acceptance
must re-test the real CLI.

The required physical re-test was completed at repair checkpoint
`c151aee95d4639209942b6ed27fb25a1d76df8ff`. Natural cancellation routed
deterministically with no provider operational-success claim; `/status` showed
`CANCELLED`; `/resume` refused the terminal cancelled mission; and projection
authority remained `none`. This final evidence record changes no runtime,
provider configuration, or authority class. **FINAL MANUAL ACCEPTANCE: GREEN.**

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
| Acquired evidence is omitted from cognitive context | Fail closed regression at the serialized provider envelope | `natural-evidence-handoff-regression.test.js` |
| Broad project analysis returns only worktree cleanliness | Reject semantic completion and continue through governed project evidence | `natural-ux-acceptance-invariants.test.js` |
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
4. `accelerator/cli/natural-governed-workspace-experience.js`
5. `accelerator/adapters/deterministic-workspace-session-adapter.js`
6. `accelerator/core/governed-workspace-discovery-index.js`
7. `accelerator/core/sensitive-content-boundary.js`
8. `accelerator/core/qualified-command-catalog.js`
9. `accelerator/core/governed-engineering-proposal.js`
10. `accelerator/cli/governed-engineering-agent-loop.js`
11. `accelerator/core/surgical-orchestrator.js`
12. `accelerator/cli/governed-patch-dispatch.js`
13. `accelerator/core/production-mutation-runtime.js`

## Claims supported by that historical baseline

- The cognitive provider is not a mutation provider.
- AI output cannot directly create operational authority.
- Project claims in the governed NATURAL analysis path require workspace
  evidence.
- NATURAL project evidence crosses a deterministic physical workspace session,
  governed discovery index, task-envelope microread policy and sensitive-content
  boundary before provider exposure.
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
