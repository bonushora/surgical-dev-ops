# ADR-020 — NATURAL Local Inference Performance Profile

**Status:** APPROVED / FROZEN
**Date:** 2026-08-25
**Scope:** Surgical DevOps / NATURAL / Local AI / Ollama
**Extends:** ADR-011, ADR-012 and ADR-014

## Context

Grounded project analysis can require several local inference calls. On a
CPU-only installation, repeated model loading and unbounded generation make
the NATURAL experience unnecessarily slow and can trigger premature timeout
failures. Performance improvements must not move the model inside the
operational trust boundary or weaken governed evidence requirements.

## Decision

Surgical DevOps SHALL use an immutable qualified local inference profile for
the default Ollama composition.

The initial profile is `ollama-balanced-v1`:

- Ollama endpoint remains fixed to loopback;
- streaming remains disabled;
- temperature remains zero;
- context is bounded to 4096 tokens;
- PLAN output is bounded to 512 tokens;
- EXPLAIN output is bounded to 1024 tokens;
- PROPOSE output is bounded to 2048 tokens;
- model residency is requested for ten minutes through `keep_alive`;
- inference timeout remains bounded to 180 seconds;
- CPU/GPU selection remains automatic inside the local Ollama runtime;
- no prompt, evidence or response content is recorded as performance
  telemetry; and
- the profile carries zero operational authority.

## Hardware acceleration

Surgical DevOps SHALL NOT install drivers, mutate host configuration or force
a platform-specific GPU selector. Ollama may use a qualified GPU when the
local runtime supports it and otherwise falls back to CPU under the same
request contract.

This keeps the JavaScript composition portable across Linux, macOS and
Windows and avoids creating a generic hardware-management surface.

## User experience

NATURAL and ENGINEER sessions SHALL present a short progress message before a
governed evidence loop or local explanation waits for inference. Progress
presentation does not create evidence, authority or a success claim.

## Preserved invariants

This decision does not change:

1. human sovereignty and explicit authorization;
2. deterministic workspace confinement;
3. governed evidence acquisition;
4. fixed loopback-only Ollama network authority;
5. model output treatment as untrusted cognitive data;
6. fail-closed behavior;
7. mutation, grant, journal, CAS or recovery authority; or
8. provider and model replaceability.

## Qualification

Qualification requires:

- exact Ollama request-body tests for residency and resource budgets;
- rejection of caller-selected unqualified budgets;
- immutable profile and zero-authority surface tests;
- NATURAL session regression tests;
- the complete canonical suite; and
- native CI success on Ubuntu, macOS and Windows.

## Decision authority

This decision is **APPROVED / FROZEN** by explicit project authority.
