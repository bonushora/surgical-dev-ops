# Changelog

All notable changes to the Surgical DevOps project will be documented in this file.

The format is inspired by Keep a Changelog:
https://keepachangelog.com/

This project adopts Semantic Versioning (SemVer) whenever applicable:
https://semver.org/

---

## [Unreleased]

---

## [2.4.0] - 2026-08-22

### Added

- Governed Content-Addressed Workspace mutation authority
- Immutable content-addressed object and manifest authority
- Genuine conditional Manifest CAS transition
- Managed materialization of authoritative generations
- Restart recovery derived from immutable authoritative evidence
- Qualified bounded Production Mutation Provider
- Local Offline Human Authority and Ed25519 signing boundary
- Production mutation runtime composition
- Governed R3 `surgical> patch` execution path
- Real-process production CLI end-to-end qualification
- Cross-process restart and persistent-authority qualification

### Changed

- Ordinary worktree state is explicitly non-authoritative for governed mutation
- Production R3 mutation advances content-addressed authority before verified
  managed materialization
- Recovery uses authoritative immutable evidence rather than ordinary worktree
  state
- Surgical CLI version advanced to v2.4.0

### Security

- Stale writers cannot redefine current Manifest CAS authority
- Conflicting writers starting from the same authority cannot both commit
  conflicting successors
- Corrupt managed projections fail closed
- Caller-selected production mutation providers remain rejected
- Production runtime exposes no private signing authority
- Generic shell/process authority remains outside the governed mutation
  boundary
- Authentication alone does not authorize R3 mutation
- Existing exact-scope capability, approval, lifecycle, journal and recovery
  invariants remain enforced

### Validation

- Canonical suite: 595 tests
- PASS: 591
- FAIL: 0
- Platform-specific SKIP: 4
- Real `surgical` process qualified through governed production R3 mutation
- Process-restart continuity and conflicting second-process mutation behavior
  qualified end-to-end

### Limitations

- BH-SEP v2.2 and BH-SDP v2.2 remain the normative protocol core
- Strict Physical Identity-Conditional CAS for ordinary pathname mutation
  remains UNQUALIFIED under ADR-009
- POWER_LOSS_VALIDATED remains false pending separate
  platform/filesystem-specific physical qualification
- Process-crash / process-restart qualification is not physical power-loss
  qualification
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

