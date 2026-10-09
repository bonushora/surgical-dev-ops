# External Engineering Review Readiness v0.1

This matrix is a reviewer navigation aid, not a new authority source or a claim
of certification. Each claim is intentionally narrower than its theme. Status
means qualified within the stated evidence boundary, not universally proven.

| REVIEW_THEME | CLAIM | ENFORCEMENT_LOCATION | TEST_OR_EVIDENCE | COMMIT_OR_ADR | QUALIFICATION_STATUS | KNOWN_LIMITATION |
| --- | --- | --- | --- | --- | --- | --- |
| R1 delegated authority | Mission authority derives only bounded operation grants; the mission grant is not directly dispatchable. | `accelerator/core/capability-grant.js`; `accelerator/cli/natural-development-patch-authorization.js`; Orchestrator admission | `capability-grant.test.js`; `natural-mission-scoped-mutation-authority.test.js`; `natural-mission-scoped-mutation-authority-adversarial.test.js` | ADR-006; ADR-038 | QUALIFIED | Qualification is for implemented bounded grant paths, not arbitrary future capability classes. |
| R2 authority lifetime / expiry | Authoritative clock, expiry, single-use consumption, and terminal mission state bound continued use. | `accelerator/core/authoritative-clock.js`; `accelerator/cli/natural-development-authorization-consumption.js` | `authoritative-clock.test.js`; `natural-development-authorization-consumption.test.js`; `natural-development-g10-post-dispatch-consumption.test.js` | ADR-038 | QUALIFIED | Host clock integrity outside the authoritative-clock boundary is not claimed. |
| R3 effective runtime authority | Cognitive/provider output has no direct mutation or approval authority; physical dispatch requires deterministic admission. | `accelerator/core/governed-ai-runtime.js`; `accelerator/core/surgical-orchestrator.js`; `accelerator/core/production-mutation-runtime.js` | `governed-ai-runtime.test.js`; `surgical-orchestrator.test.js`; `production-mutation-runtime.test.js` | ADR-004; ADR-013; ADR-038 | QUALIFIED | Model quality and semantic correctness remain probabilistic. |
| R4 provenance | Operation records, evidence fingerprints, journal entries, and exact-SHA CI associate decisions and effects with bounded sources. | `accelerator/core/operation-record.js`; mutation journal; `accelerator/ci/qualification-evidence.js` | `operation-record.test.js`; `mutation-journal-adapter.test.js`; `qualification-evidence.test.js` | ADR-007; ADR-025; exact-SHA CI | QUALIFIED | CI artifact retention is bounded and is not permanent archival storage. |
| R5 crash / restart / recovery | Restart reconciliation uses durable evidence and does not restore operational authority from conversation or stale snapshots. | mutation recovery; durable task/mission stores; G9/G10 recovery composition | `natural-development-g9-g10-crash-window-adversarial.test.js`; `natural-durable-mission-continuity-r6.test.js`; `mutation-recovery.test.js` | ADR-007; ADR-008; ADR-038 | PARTIALLY_QUALIFIED | Sudden physical power-loss safety is not qualified; some persisted-store rollback cases remain architecture decisions. |
| R6 containment boundaries | Provider and Linux execution containment deny non-authorized transport, host surface, ambient secrets, and native fallback within qualified profiles. | containment profile/transport adapters; Linux Bubblewrap provider | `containment-hardening-v2.test.js`; `codex-cognitive-containment.test.js`; `execution-isolation-live.test.js` | ADR-045; ADR-046; ADR-047 | QUALIFIED | Kernel escape, universal side channels, and non-Linux execution isolation are not claimed. |
| R7 workspace / repository identity continuity | Exact physical workspace and repository evidence must remain consistent across authorization, mutation, and resume. | workspace boundary; deterministic workspace session; repository observation | `workspace-boundary-platform.test.js`; `authority-physical-workspace-platform.test.js`; `natural-development-workspace-substitution-adversarial.test.js` | ADR-009; ADR-010; ADR-038 | QUALIFIED | Strict ordinary-pathname physical-identity CAS remains unqualified. |
| R8 enforcement placement | Deterministic Surgical components, not the model or sandbox, own authority checks and physical dispatch. | Gateway/Orchestrator boundary; qualified command catalog; governed dispatch | `integrated-governed-agent-gateway.test.js`; `qualified-command-catalog.test.js`; `surgical-cli-governed-patch.test.js` | ADR-004; ADR-037; ADR-038 | QUALIFIED | A future integration must independently preserve this placement. |
| R9 confused-deputy resistance | Target, scope, physical workspace, tenant/project, operation, risk, and evidence bindings reject substitution and widening. | task/envelope authorization; capability grants; workspace/CAS bindings | `natural-task-envelope-authorization.test.js`; `natural-mission-scoped-mutation-authority-adversarial.test.js`; `natural-development-workspace-substitution-adversarial.test.js` | ADR-009; ADR-038 | QUALIFIED | This is not a proof against every future deputy or plugin composition. |
| R10 authority creation / amplification / transfer | Tools, HelpMe, model output, local mutation, and provider substitution cannot create or transitively widen authority. | human identity assertion; provider selection; mission policy; Orchestrator | `human-identity-assertion.test.js`; `mission-runner-policy-v23.test.js`; `ai-provider-selector.test.js` | ADR-006; ADR-022; ADR-033; ADR-038 | QUALIFIED | Separate human decisions are still required for push, merge, release, publication, and deployment. |
| R11 persisted authority-record integrity | Position and physical-context binding detect measured cross-slot and context substitution while runtime replay remains fail-closed. | authorization-consumption store and linearizable G9/G10 transition | `natural-development-agmi-store-hardening.test.js`; `natural-development-production-antireplay-integration.test.js`; `AGMI-STORE-HARDENING-v1.md` | AGMI hardening at current baseline | PARTIALLY_QUALIFIED | Truncation, deletion, same-slot lifecycle rollback, snapshot rollback, authenticated head, and keyed authenticity remain explicit decisions. |
| R12 runtime isolation boundaries | Linux Bubblewrap executes an already-authorized argv with denied network, absent host root/HOME, exact workspace, and portable exact executable binding. | `execution-envelope.js`; `runtime-profile.js`; `linux-bwrap-execution-provider.js` | 38 structural tests; 15 live tests; portable-binding qualification; review demo | ADR-046; ADR-047; `42b179f820b31d0726dcf6aa776a9f5ee65addbb` | QUALIFIED | Experimental Linux-only backend; no default or production wiring; macOS/Windows backend not qualified. |
| R13 fail-closed behavior | Invalid schema, missing backend, timeout, bounded output, and failed isolation do not become native execution or success. | runtime profile/envelope/provider; Orchestrator/provider adapters | `execution-isolation-structural.test.js`; `execution-isolation-live.test.js`; `surgical-orchestrator.test.js` | ADR-004; ADR-046; ADR-047 | QUALIFIED | Availability may be reduced; fail-closed behavior is not an availability guarantee. |
| R14 replay / CAS protections | Manifest CAS, consumed authorization, physical re-observation, and recovery deny tested stale or conflicting effects. | Manifest CAS; content-addressed mutation; G9/G10 consumption; journal/recovery | `git-manifest-cas.test.js`; `content-addressed-mutation-provider.test.js`; `natural-development-production-antireplay-integration.test.js` | ADR-007; ADR-009; ADR-010; ADR-038 | PARTIALLY_QUALIFIED | Strict pathname physical-identity CAS and complete persisted-store rollback detection remain unqualified. |
| R15 human sovereign authority | Human identity and explicit authorization remain the sole origin for authority expansion; isolation and cognition remain subordinate. | human identity assertion; local human authority; Orchestrator | `human-identity-assertion.test.js`; `local-offline-human-authority.test.js`; `local-offline-human-signing.test.js` | ADR-006; ADR-038; BH-SEP v2.4 | QUALIFIED | Tests validate contracts; they do not create or impersonate human authority. |

## Classification totals

```text
QUALIFIED_COUNT=12
PARTIALLY_QUALIFIED_COUNT=3
DOCUMENTED_ONLY_COUNT=0
OUT_OF_SCOPE_COUNT=0
NOT_QUALIFIED_COUNT=0
```

These totals classify the fifteen narrow claims in this table. Broader nonclaims
remain outside those claims and are not converted to qualified properties.

## Demonstration relationship

The reproducible demo directly exercises R6, R12, and R13 using existing support
APIs. It carries fixed evidence labels for review but does not reproduce the
production human-signing or mutation pipeline. Those labels are not authority,
and the harness does not claim an end-to-end production integration.

```text
REVIEW_DEMONSTRATION_HARNESS=YES
PRODUCTION_WIRING=NO
AUTHORITY_MODEL_CHANGED=NO
```

R1–R5, R7–R11, R14, and R15 remain reviewable through the referenced production
modules, tests, ADRs, and historical evidence. The AGMI limitations and other
partial qualifications are review targets, not hidden green claims.
