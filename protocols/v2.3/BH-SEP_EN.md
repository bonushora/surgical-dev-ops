# BH-SEP v2.3 — Safe Evolution Protocol

## Objective

Govern AI-assisted evolution with risk-proportionate safety while preserving human authority, predictability, and physical evidence. This version adopts **Governance Without Friction**: controls protect consequential decisions and mutations without turning every operation into an interruption.

## Normative invariants

1. **Human authority:** AI may analyze and propose, but it may not expand authorization or replace a human decision required by context.
2. **Fail-closed:** when authority, evidence, or a rule is missing or ambiguous, do not perform the mutation; declare the block.
3. **PATCH by default:** changes must be minimal and localized. Refactoring requires explicit human authorization.
4. **Physical evidence:** claims about state, lines, tests, Git, or artifacts must rely on observable evidence. Missing evidence is `NÃO_EXECUTADO` (or the normative equivalent), never an inference presented as fact.
5. **Red-to-Green:** before refactoring or a high-risk change, verify the relevant baseline; then validate the change to GREEN or declare the block.

## Risk-proportionate governance

Classify the operation before mutating:

- **BAIXO:** documentation, low-impact adjustments, micro-readings, and operations already covered by current authority. Inspect relevant context and use proportional validation (for example, Markdown lint, parsing, or a documentation test). No new approval is needed for an operation already authorized.
- **MÉDIO:** a change with limited consumers, behavior, or dependencies. State the objective, cause or hypothesis, files and ranges read, risk, and scope estimate; perform targeted validation and record the result.
- **ALTO:** refactoring, architectural change, security, data, public contracts, or broad operational effect. Require a prior baseline, an explicit plan, and specific human authorization before mutation; validate comprehensively.

A diff estimate predicts scope; it is not a physical three-line limit. If scope grows, reassess risk and request authorization when the category or authorization changes.

Risk belongs to the delimited operation, not to the project as a whole. Reclassify
mandatorily when scope or environment changes.

| Level | Criterion and proportional control |
| --- | --- |
| **BAIXO** | Local, reversible, isolated operation with no credentials or external effect; one authorization; no intermediate gates; directly pertinent validation. |
| **MÉDIO** | Limited functional change, affected consumers, integration, or reversible publication; gates only for a new boundary; consumer tests, CAS, and remote postcondition. |
| **ALTO** | Production, sensitive credentials, real data, destructive action, irreversibility, or architecture; explicit authorization, rollback, before/after evidence, and pertinent/canonical suite. |

## Authorization, execution, and gates

Each delimited task receives one authorization bound to its objective, scope,
workspace, risk, and declared boundaries. A task does not authorize another task
or permit scope expansion by inference.

One runner carries the task across the declared boundaries (local, backend,
interface, operation, deployment, and publication). The user does not carry state,
credentials, results, or context between stages; the runner delivers bound
evidence or stops closed.

Gates are required only for real risk, authority expansion, credentials,
destructive action, or an external resource. Consolidate related human actions
into one explicit decision. After two equivalent attempts make no verifiable
progress, trip the circuit breaker, preserve evidence, and request human direction.

Proportionality is mandatory: localhost uses minimal local controls; Preview uses
the required integration gates and evidence; Production requires explicitly
qualified authority, credentials, publication, and reversibility. No environment
inherits authority from another.

GREEN is separated into **code**, **backend**, **interface**, **operation**,
**deployment**, and **publication**, each requiring independent evidence. The
human flow (input, review, decision, and recovery) must be validated before
functional GREEN. Optional improvements remain `DEFERRED`, with scope and a
future review point.

## Execution and completion contract

Define the completion contract before execution: objective, files, workspace,
environment, operations, risk, boundaries, physical postcondition, and required
evidence. One authorization binds all these elements. One continuous runner operates
within the authorized envelope across declared boundaries; the user does not
manually carry context, results, or credentials between stages.

Gates exist only for real risk, authority, credentials, an external resource,
irreversibility, or publication. Related human actions are consolidated into one
gate. After two equivalent attempts make no verifiable progress, trip the circuit
breaker, preserve evidence, and stop in `BLOCKED`.

Within the authorized envelope, continuation may be automatic. Reuse evidence only
while object, hash, and environment remain unchanged. Valid states include
`BLOCKED`, `WARNING`, `DEFERRED`, and `NOT_APPLICABLE`; none is GREEN by inference.
The friction budget records gates, attempts, manual actions, and environment changes.

## Physical boundaries and evidence

`localhost`, `Preview`, and `Production` are independent boundaries. The mandatory
physical destination identity includes URL, branch, and remote SHA; no environment
inherits authority from another. Confirm CAS before any remote mutation. After it,
confirm the destination's physical postcondition. An executor's report is not
physical evidence: only an observation bound to Git state, content, and environment
qualifies the result.

PATCH is the default. Preserve fail-closed behavior, human authority, CAS, journal,
recovery, and the trust boundary; local mutation does not authorize push, merge, tag,
release, publication, or deploy.

## Inspection and focus windows

Inspect enough material first to explain root cause, hypothesis, risk, and proposed change. For files over 300 lines, use focus windows when needed for safety or context. Size alone does not require automatic human interruption or full-file reading; widen the window when the decision depends on additional context.

Micro-readings and operations covered by current authority may proceed without new approval. AI must stop and declare a block upon divergence, insufficient authorization, reclassified risk, or unverifiable evidence.

## Automation restriction, not human restriction

**Automation Restriction, Not Human Restriction** means limiting what automation may mutate, publish, or assert without additional controls; it does not obstruct human inspection, demand artificial confirmations, or remove already-granted authority. Controls apply to the automated action and its risk, not to the person or every trivial reading.

## Validation and delivery

Change only the authorized scope. For low risk, validate proportionally; for medium risk, validate affected consumers; for high risk and refactoring, preserve the baseline and explicit authorization and run the pertinent suite. Do not invent results, hashes, lines, or tests. On divergence, remain fail-closed.

Use the BH-SDP v2.3 `sdp_snapshot` at relevant checkpoints: session handoff, block, divergence, important phase change, and relevant conclusion. A snapshot is not required at the end of every response.

Snapshots are incremental: record only the delta since the previous snapshot, the
accumulated gate count, and new anchors; do not repeat confirmed context. The
snapshot preserves fail-closed behavior, human authority, CAS, journal, and the
trust boundary; it never creates authority.
