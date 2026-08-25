# ADR-019 — Single-Agent Governed Engineering Loop

**Status:** IMPLEMENTED / CI QUALIFICATION REQUIRED
**Date:** 2026-08-25
**Scope:** Surgical DevOps v2.5 / Engineer Mode / Governed Proposals
**Extends:** ADR-011, ADR-012, ADR-013 and ADR-014

## Context

The cognitive R0 path was already qualified, but an engineering model still
needed a canonical way to propose a concrete change without becoming an
execution, approval or mutation authority.

## Decision

The initial engineering-agent path is a single-agent, two-phase composition:

1. the human authorizes a bounded, non-mutating project-analysis task;
2. the recursive evidence loop obtains only governed workspace evidence;
3. the cognitive provider may return one exact patch proposal;
4. the proposal boundary validates its complete shape, target, BEFORE hash,
   canonical Base64 replacement, size and validation kind;
5. the engineering loop binds the proposal to a READ_FILE target and SHA-256
   actually observed by the Orchestrator;
6. the loop stops at `HUMAN_AUTHORITY_REQUIRED`;
7. physical mutation remains a separate explicit R3 `patch` command through
   the existing production mutation boundary.

The proposal result carries `operationalAuthority: false`,
`mutationAuthority: false` and `approvalAuthority: false`.

## Security invariants

- Cognitive output never becomes a capability grant.
- An extra output field is rejected rather than ignored.
- Absolute, traversing, non-canonical and multiline targets are rejected.
- A proposed change must match the exact observed target and BEFORE hash.
- Evidence failure prevents proposal generation.
- Provider failure fails closed before mutation.
- A conversational `sim` authorizes evidence collection only; it cannot apply
  the later patch proposal.
- The R3 command remains independently responsible for clean-worktree checks,
  human identity, risk, grant, CAS, journal, durability and recovery.

## Interaction modes

- NATURAL continues to produce grounded explanations and stops without a
  mutation proposal.
- ENGINEER exposes the qualified target, BEFORE/AFTER hashes, validation kind,
  reason and exact separate R3 command.
- EXPERT preserves the deterministic command surface.

## Provider boundary

The loop is provider-neutral. Ollama remains the qualified reference provider.
Remote providers remain optional and require their own adapter, credential,
privacy and commercial qualification; their absence does not make the local
Orchestrator incomplete.

## Qualification

The implementation adds contract, adversarial, cognitive-session,
single-agent-loop and interactive ENGINEER tests. Canonical three-platform CI
remains the acceptance authority for this record.

## Explicit non-claims

- No unrestricted agent execution is introduced.
- No generic shell is introduced.
- No multi-agent authority is introduced.
- No physical power-loss qualification is claimed.
- No strict pathname physical-identity CAS qualification is claimed.
