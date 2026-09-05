# ADR-018 — Immutable Protocol RAW Artifacts and International Documentation

**Status:** Approved and Frozen

**Date:** 2026-08-25
**Decision owner:** Human project authority

## 1. Context

Surgical DevOps originated with Portuguese BH-SEP v2.2 and BH-SDP v2.2 RAW
artifacts. The project is now preparing for international engineering review,
which requires an English-first repository entry point.

Internationalization must not erase project origin, silently redefine normative
text, break existing RAW URLs, or make translations appear to replace approved
protocol authority.

## 2. Decision

The default `README.md` is English. `README_PT-BR.md` is the equivalent
Portuguese public entry point. `README_EN.md` is a full English mirror of
`README.md`, retained as a compatibility path.

The following original Portuguese protocol artifacts are immutable:

- `protocols/BH-SEP.md`
- `protocols/BH-SDP.md`

Their existing RAW URLs must continue serving the original v2.2 content.

## 3. Integrity anchors

At approval time:

| Artifact | SHA-256 |
| --- | --- |
| `protocols/BH-SEP.md` | `f4e8639163b0321fff86133a69ec59c2822ccdebcd24d2ccb459b5bc1c3b35cb` |
| `protocols/BH-SDP.md` | `04ea782ada1abf7fb959329054c57f87a0e86fca99a31d2e37751d3bdf7d47bc` |

An integrity mismatch requires explicit human review. It cannot be normalized as
an ordinary translation or documentation cleanup.

## 4. Translation boundary

English translations remain separate at:

- `protocols/BH-SEP_EN.md`
- `protocols/BH-SDP_EN.md`

A translation improves accessibility but does not acquire authority to alter the
frozen original.

## 5. Future versions

Future normative protocol versions must use new versioned paths such as
`protocols/v2.3/`. They may be identified by an index as recommended or current,
but must not overwrite, rename, delete, redirect, or repurpose the v2.2 RAW paths.

## 6. External review presentation

The repository must lead with technically sober English documentation that:

- separates probabilistic cognition from deterministic operational authority;
- links public reproducible evidence;
- distinguishes platform-specific mechanisms;
- states limitations next to qualified results;
- preserves a Portuguese entry point with equivalent public claims.

## 7. Consequences

- Existing protocol consumers retain stable RAW URLs.
- International readers receive an English-first overview.
- Portuguese origin and normative artifacts remain visible and intact.
- Documentation growth becomes additive and versioned rather than destructive.
- Bilingual public claims must remain semantically equivalent.

## 8. Prohibited shortcuts

- Replacing Portuguese protocol files with English content.
- Updating a frozen RAW path in place for a future version.
- Presenting translations as silent normative replacements.
- Removing limitations to make external messaging appear stronger.
- Claiming security properties beyond recorded evidence.

## 9. Approval record

This decision was explicitly approved and frozen by the human project authority
on 2026-08-25. Changing it requires a new explicit architectural decision.
