# ADR-035 — Qualified Local Inference Latency Contract Reconciliation

- Status: APPROVED / FROZEN
- Date: 2026-08-30
- Manual acceptance correction: 2026-09-01
- Scope: NATURAL local Ollama inference latency and bounded-output contract
- Nature: documentation of the latest physically implemented and qualified contract

## Context

ADR-020 established the initial `ollama-balanced-v1` profile with a 4,096-token
context, PLAN 512, EXPLAIN 1,024, PROPOSE 2,048 and a 180-second timeout.

ADR-023 subsequently qualified bilingual CPU inference with PLAN 256, EXPLAIN
512, a 2,800-character per-evidence ceiling and Qwen no-thinking control while
retaining the 180-second timeout.

ADR-027 then advanced the profile to `ollama-cpu-bounded-v3` and increased PLAN
from 256 to 512 after real Qwen truncation evidence. A later qualified change,
commit `eb901b53cf6b4e328bb1e8e32e49922a2f2d2be6`, reduced the fail-closed local
transport timeout from 180 seconds to 60 seconds and bound terminal pacing. That
value remained the implemented contract through checkpoint
`38904d79b61436a23b44eb2432a049415bb30795`.

At that checkpoint, the runtime and targeted tests consistently enforced the
60-second contract. The historical ADRs remain valid records of their respective
stages, but the later manual workload observation required the bounded
correction recorded below.

## Decision

The qualified NATURAL local inference contract is frozen as follows:

- profile: `ollama-cpu-bounded-v3`;
- acceleration selection: `OLLAMA_AUTO`;
- context ceiling: 4,096 tokens;
- PLAN output ceiling: 512 tokens;
- EXPLAIN output ceiling: 512 tokens;
- PROPOSE output ceiling: 2,048 tokens;
- per-evidence character ceiling: 2,800 characters;
- model residency request: `keep_alive=10m`;
- fail-closed local transport timeout: 180,000 milliseconds;
- Qwen-compatible structured requests: `/no_think` appended at the fixed
  adapter boundary;
- content telemetry: disabled;
- operational authority: absent.

These values supersede only the earlier performance values where ADR-020,
ADR-023 or ADR-027 differ. Their authority, safety, privacy and architectural
invariants remain unchanged.

## Deterministic boundary

The profile controls cognitive resource use only. It cannot grant filesystem,
network, process, shell, Git, mutation, approval, release or publication
authority. Timeout, truncation, malformed output or model failure cannot expand
authority and must fail closed through the existing governed composition.

Hardware acceleration remains selected by the installed Ollama runtime. The
contract does not mutate drivers or create platform-specific operational
authority.

## Qualification requirements

Closure requires all of the following from the same clean physical state:

1. exact immutable-profile and zero-authority assertions;
2. exact transport option propagation and 180-second timeout binding;
3. exact Qwen no-thinking adapter behavior;
4. exact 2,800-character evidence ceiling;
5. rejection of unknown capability budgets;
6. targeted local-inference tests green;
7. complete canonical Accelerator suite green;
8. unchanged remote main and immutable RC.6 tag;
9. no release, tag movement, push or npm publication.

## Consequences

The latency milestone governed by ADR-020, ADR-023 and ADR-027 is considered
reconciled when the qualification requirements above pass and this ADR is
committed from that same state.

After this closure, the separately frozen ADR-034 Deterministic Governed
Workspace Experience may enter implementation in a subsequent milestone.

## Manual acceptance correction

The final v2.6 manual session proved that the 60-second value was incompatible
with the already-qualified broad NATURAL project-analysis workload on the
default CPU local profile. The real request contained 2,358 input tokens. At
59.997 seconds, only 2,048 input tokens had been processed and Ollama cancelled
the request before prompt processing completed. No context truncation occurred.

The deterministic regression uses those physical observations rather than an
arbitrary replacement value. At the observed effective processing rate, the
2,358-token input plus the existing 512-token PLAN ceiling has an optimistic
84,078-millisecond lower bound. The 60,000-millisecond deadline is therefore
provably incompatible. Restoring the previously qualified 180-second CPU budget
is the smallest profile correction with established architectural precedent.

The provider remains Qwen 3 8B by default, context remains explicitly bounded
to 4,096 tokens, thinking remains disabled, evidence remains governed and
normalized, and timeout continues to abort fail-closed. The CLI derives its
deadline disclosure from this profile and exposes the bounded wait before
provider cognition. No authority or mutation behavior changes.
