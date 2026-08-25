# Surgical DevOps Roadmap

This roadmap describes the strategic evolution of the Surgical DevOps ecosystem.

Dates are intentionally omitted.
Progress is milestone-driven rather than time-driven.

---

# Version 1.0 — Foundation ✅

Completed

- BH-SEP (Safe Evolution Protocol)
- BH-SDP (Snapshot & Delivery Protocol)
- Bilingual documentation
- Technical papers
- LLM regression guides
- MIT License
- CHANGELOG
- CONTRIBUTING guide

---

# Version 1.1 — Adoption

Planned

- Practical implementation examples
- GitHub workflow examples
- Prompt activation templates
- Best practices documentation
- Real-world case studies

---

# Version 1.2 — Tooling

Planned

- GitHub Actions examples
- CI/CD validation examples
- Protocol validation checklists
- Documentation templates
- Multiplatform snapshot architecture (BH-SDP): separate logical snapshot requirements from platform-specific physical snapshot mechanisms

---

# Version 1.5 — Integrations

Planned

- MCP compatibility guidance
- IDE integration recommendations
- AI workflow examples
- Enterprise adoption guidelines

---

# Commercialization & Distribution Readiness

Planned

- Governed by [ADR-005](docs/adr/ADR-005-surgical-devops-commercial-distribution-strategy.md) and the revisionable [Commercial Baseline](docs/strategy/commercial-baseline.md)
- Community and early-access validation
- Technical launch and discovery
- Marketplace eligibility and direct commercial channel
- Enterprise and self-hosted readiness

---

# Version 2.0 — AI Governance Platform

Vision

- Multi-agent governance
- Cross-session orchestration
- Protocol federation
- Governance metrics
- Enterprise compliance
- Reference implementations

---

# Version 2.3 — Development Orchestration Layer ✅

Completed

- Surgical DevOps Accelerator / Orchestrator
- Deterministic repository discovery and task preparation
- Authenticated human authority boundary for R3 operations
- Exact-scope capability grants
- Governed FILESYSTEM_PATCH mutation transactions
- Exact-target mutation locking
- Durable mutation journal
- Persisted commit authority
- Deterministic process-crash / process-restart recovery
- Filesystem durability primitive enforcement
- Qualified mutation-provider boundary
- Hardened Git preflight
- Canonical 508-test conformance suite
- GitHub Actions conformance workflow
- Direct Linux / Windows / macOS canonical conformance matrix validated on
  GitHub Actions run 32545548306 at commit 0586fa4113de00c075113f12fd98059f44feba8f
- Safe Exclusive Write primitive qualified on Linux / Windows / macOS

Explicit qualification boundaries retained at v2.3 closure:

- POWER_LOSS_VALIDATED remains false pending platform/filesystem-specific
  qualification
- Strict Physical Identity-Conditional CAS remains UNQUALIFIED
- production physical mutation dependent on strict physical CAS remains
  fail-closed
- strict physical CAS qualification continues only as a separate specialized
  qualification line and is not a prerequisite for v2.3 closure

---

# Version 2.4 — Governed Content-Addressed Mutation Authority ✅

Completed

- Governed Content-Addressed Workspace adopted as mutation authority
- Immutable content-addressed objects and authoritative manifests
- Genuine conditional Manifest CAS authority transition
- Ordinary worktree explicitly retained as a non-authoritative projection
- Managed materialization separated from authoritative CAS
- Idempotent restart recovery from immutable authoritative evidence
- Stale writer rejection and conflicting successor prevention
- Corrupt managed projection detection with fail-closed recovery
- Qualified bounded Production Mutation Provider
- Local Offline Human Authority with Ed25519 signing
- Production runtime composition without private signing authority
- Governed R3 `surgical> patch` production boundary
- Real-process CLI end-to-end operational qualification
- Cross-process restart and persistent-authority qualification
- Canonical suite: 595 tests, 591 PASS, 0 FAIL, 4 platform-specific SKIP

Explicit qualification boundaries retained at v2.4 operational closure:

- BH-SEP v2.2 and BH-SDP v2.2 remain the normative protocol core
- Strict Physical Identity-Conditional CAS for ordinary pathname mutation
  remains UNQUALIFIED under ADR-009
- ordinary worktree state cannot independently establish mutation authority
- POWER_LOSS_VALIDATED remains false pending separate
  platform/filesystem-specific physical qualification
- process-crash / process-restart qualification does not constitute universal
  physical power-loss qualification
- generic shell/process authority and caller-selected production mutation
  providers remain outside the production mutation boundary

---

# Version 2.5 — Intent-Driven Governed Orchestration ✅

Completed implementation scope

- NATURAL, ENGINEER and EXPERT interaction contracts
- Provider-neutral cognitive port, selection, invocation and execution seams
- Ollama as the replaceable local reference provider
- Governed recursive workspace-evidence acquisition
- Grounded NATURAL project analysis with zero-evidence rejection
- Strict immutable engineering patch-proposal contract
- Single-agent governed engineering loop
- Exact proposal binding to an observed READ_FILE target and BEFORE SHA-256
- ENGINEER technical presentation of target, BEFORE/AFTER hashes, validation
  and the separately authorized R3 command
- Explicit stop at `HUMAN_AUTHORITY_REQUIRED` before every proposed mutation
- Existing human identity, risk, capability, Manifest CAS, journal, durability
  and recovery boundaries preserved for physical R3 execution
- Expert / Deterministic compatibility preserved

Optional or separately qualified extensions

- Remote commercial AI adapters and credential boundaries
- Multi-agent cognitive coordination
- Physical power-loss qualification
- Strict Physical Identity-Conditional CAS for ordinary pathnames
- Commercial activation and payment infrastructure

Those extensions do not weaken or silently broaden the completed local
single-agent Orchestrator boundary.

---

# Guiding Principle

The objective of Surgical DevOps is not merely to improve prompts.

Its long-term vision is to establish an open governance layer for AI-assisted software engineering that is independent of any specific LLM provider.
