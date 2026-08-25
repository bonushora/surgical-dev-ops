# ADR-022 — Qualified Local Model Selection and External Provider Substitution

Status: **APPROVED AND FROZEN**
Date: 2026-08-25

## Context

The first NATURAL local-provider baseline used `llama3:latest`. Manual qualification exposed unacceptable latency, weak Brazilian Portuguese, malformed structured decisions, fictitious targets and shallow grounded responses. The deterministic Orchestrator contained those failures correctly, but containment does not make a model suitable for a qualified user experience.

The product requires a useful no-fee local baseline and a provider-neutral path to stronger external services without moving models inside the operational trust boundary.

## Decision

NATURAL has a closed registry with exactly two natively supported local cognitive profiles:

1. `qwen3:8b` through Ollama — default bilingual quality profile;
2. `gemma3:4b` through Ollama — bilingual fast profile.

`llama3:latest` is not a default, alternative or automatic fallback. Historical evidence and the deterministic defenses learned during its qualification remain preserved.

Local models are not bundled and are never downloaded automatically. A model must already exist in the bounded Ollama inventory before session activation. Selection is explicit, session-scoped and non-persistent. A successful selection rebuilds the cognitive composition and clears temporary conversational memory and decision cache. A missing or unqualified model preserves the previous provider and fails closed.

External free or paid providers may replace the local profiles only through individually qualified adapters. An adapter must bind endpoint, identity, credential boundary, cognitive capabilities, context and output limits, timeout, privacy disclosure, commercial disclosure and failure semantics. No arbitrary endpoint, model name or credential-bearing configuration becomes trusted provider authority.

## Invariants

- Models retain zero operational authority.
- Provider selection cannot authorize filesystem, process, shell, Git, network expansion, credentials or mutation.
- The cognitive model cannot select or install its successor.
- The Orchestrator never downloads a model automatically.
- Local selection accepts only the immutable closed registry.
- External providers are not selected automatically.
- Provider changes do not alter BH-SEP, BH-SDP, human sovereignty, workspace confinement, governed evidence, R3 or fail-closed behavior.
- Costs and terms belong to the external provider and must be disclosed before explicit user activation.
- Surgical DevOps receives no commission from provider consumption.

## User surface

The qualified local commands are:

```text
listar modelos
usar qwen3:8b
usar gemma3:4b
qual IA está ativa?
```

Requests for OpenAI/Codex or another external provider stop at the qualification/setup boundary until the corresponding adapter is implemented and qualified.

## Consequences

The free default becomes materially stronger while retaining a faster local alternative. The supported matrix remains small and testable. Users may later choose paid cognition without changing deterministic operational governance. Supporting a new provider now requires explicit engineering and conformance evidence rather than a caller-supplied string.
