# Changelog

All notable changes to the Surgical DevOps project will be documented in this file.

The format is inspired by Keep a Changelog:
https://keepachangelog.com/

This project adopts Semantic Versioning (SemVer) whenever applicable:
https://semver.org/

---

## [Unreleased]

### Validation

- Canonical Accelerator suite expanded to 503 tests
- Direct Linux / Windows / macOS conformance matrix: PASS
- GitHub Actions qualification run: 32539804002
- Qualified technical baseline: `ff6d6e069558f9fddda3ca4cf3823bb1e89f801a`

### Platform

- Windows native filesystem durability helper qualified in canonical CI
- Git repository-root authority preserves the already authorized physical
  workspace representation after physical identity verification
- Git preflight remains bounded and fail-closed with a 5000 ms execution limit

### Limitations

- POWER_LOSS_VALIDATED remains false pending platform/filesystem-specific
  physical qualification
- Production physical mutation remains fail-closed without a qualified
  compare-and-replace provider

---

## [2.3.0] - 2026-08-21

### Added

- Development Orchestration Layer
- Surgical DevOps Accelerator / Orchestrator
- Authenticated human authority boundary for critical R3 execution
- Exact-scope capability grants
- Governed FILESYSTEM_PATCH transaction model
- Exact-target mutation lock
- Durable mutation journal
- Persisted commit-authority evidence
- Deterministic process-crash / process-restart recovery
- Filesystem durability primitive enforcement
- Qualified mutation-provider boundary
- Canonical Accelerator conformance command
- GitHub Actions canonical conformance workflow

### Security

- Fail-closed provider qualification
- Commit-boundary authority expiry enforcement
- Protected Git preflight with minimized/redacted evidence
- Conflicting replay rejection
- Zero duplicate physical mutation after proven recovery
- Ancestor replacement detection before physical publish
- Orphan-lock recovery only with trusted owner-termination proof

### Validation

- ADR-007 acceptance criteria: 18/18 PASS
- Canonical Accelerator suite: 427/427 PASS
- Clean archive conformance: PASS

### Limitations

- BH-SEP v2.2 and BH-SDP v2.2 remain the normative protocol core
- Cross-platform architecture is defined, but full Linux / Windows / macOS
  conformance requires direct per-platform validation
- POWER_LOSS_VALIDATED remains false pending platform/filesystem qualification
- Production physical mutation remains fail-closed without a qualified
  compare-and-replace provider

---

## [1.0.0] - 2026-07-21

### Added

- BH-SEP (Safe Evolution Protocol)
- BH-SDP (Snapshot & Delivery Protocol)
- Bilingual project documentation (Portuguese and English)
- Technical article (Portuguese and English)
- LLM Regression Protocol guide (Portuguese and English)
- MIT License

### Documentation

- Surgical DevOps governance model
- AI activation workflow
- Snapshot & Delivery workflow
- Protocol applicability guides
- Unified project README
- Cross-language documentation navigation

### Notes

This is the first public release of the Surgical DevOps ecosystem.

It establishes the initial governance model for AI-assisted software engineering,
focusing on:

- Safe software evolution
- Minimal code intervention
- Context preservation across long AI sessions
- Reduction of regressions caused by LLM-assisted development

