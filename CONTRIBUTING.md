# Contributing to Surgical DevOps

Thank you for your interest in contributing to Surgical DevOps.

Our goal is to build an open, vendor-agnostic governance framework for AI-assisted software engineering.

Because this repository defines protocols rather than software libraries, contributions should prioritize clarity, consistency, and reproducibility.

---

# Guiding Principles

Every contribution should preserve the core principles of Surgical DevOps.

## 1. Truth First

Never introduce documentation or protocol behavior that contradicts an existing approved specification without explicitly proposing the change.

The current protocol documentation is the project's source of truth.

---

## 2. Minimal Changes

Whenever possible:

- improve instead of rewrite;
- extend instead of replace;
- preserve existing structure.

Large rewrites should be discussed before implementation.

---

## 3. Bilingual Consistency

Whenever documentation is modified:

- `README.md` is the canonical English public entry point.
- `README_PT-BR.md` is the equivalent Portuguese public entry point.
- `README_EN.md` is retained only as a compatibility path.
- English and Portuguese public claims must remain semantically equivalent.
- The original Portuguese protocol RAW artifacts must remain unchanged.
- Future protocol versions must use new versioned paths.

---

## 4. Protocol Stability

Changes affecting BH-SEP or BH-SDP should prioritize backward compatibility whenever possible.

Breaking changes must be clearly documented.

---

# Pull Requests

Please ensure that your Pull Request:

- has a clear objective;
- modifies only the necessary files;
- keeps documentation synchronized;
- includes justification for protocol changes.

---

# Commit Messages

We recommend Conventional Commits.

Examples:

docs: update README

docs: improve BH-SEP specification

docs: add protocol examples

fix: correct documentation inconsistency

---

# Discussions

If your proposal changes the philosophy or governance model of Surgical DevOps, open an Issue before implementing the change.

Discussion before implementation helps preserve protocol stability.

---

Thank you for helping improve Surgical DevOps.
