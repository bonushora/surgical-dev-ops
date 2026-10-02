# ADR-045 — BH v2.4 RAW with Integrated Containment

**Status:** Approved and Frozen
**Date:** 2026-10-02
**Decision owner:** Human project authority

## Decision
v2.2 and v2.3 RAW remain immutable. A new normative line is created at `protocols/v2.4/`. BH-SEP v2.4 incorporates protected-profile validation, fail-closed profile behavior, bounded external transport, host-mediated credentials, authorized egress, independent qualification dimensions, and explicit non-universal claims. BH-SDP v2.4 records containment continuity without allowing snapshots to create or restore authority.

Active profile: `BH-SEP-v2.4+BH-SDP-v2.4+BH-CONTAINMENT-integrated-v1`.

WebSocket remains `BLOCKED_BEFORE_UPGRADE` until a separate adversarial RED-to-GREEN campaign qualifies it. Unexecuted provider or platform-specific containment claims remain unpromoted. No universal AI/ASI containment claim is authorized.

This ADR grants no merge, release, publication, credential, or deployment authority.
