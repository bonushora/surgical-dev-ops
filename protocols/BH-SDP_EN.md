# 📦 BH-SDP — Snapshot & Delivery Protocol (v2.0)

The **BH-SDP (Snapshot & Delivery Protocol)** is a state encapsulation and preservation protocol for AI-assisted development sessions.

v2.0 introduces **Physical Anchors** to eliminate context amnesia and hallucinations.

---

## 🏛️ Principles of State Preservation

### 1. Physical Anchors (Anti-Amnesia)
Snapshots do not accept loose text alone. They MUST reference real metadata from the repository/environment:
- **Git Commit Hash:** Exact commit hash or `uncommitted` status.
- **Test Status:** Objective test suite result (`PASS`, `FAIL`, `NOT_RUN`).
- **Last Inspected Lines:** Log of inspected files and line ranges.

### 2. Strict JSON Format
Every Snapshot must be emitted in a structured `sdp_snapshot` block for rapid copying, programmatic validation, and session recovery.

---

## 🤖 Artifact: Strict Snapshot Schema (v2.0)

Every technical output or phase completion MUST end with:

```sdp_snapshot
{
  "project_name": "Project Name",
  "protocol_version": "BH-SDP-v2.0 / BH-SEP-v2.0",
  "arch_type": "Current Architecture (e.g., BH-SMC)",
  "cost_target": "Cost Target",
  "current_phase": "Development Phase",
  "physical_anchors": {
    "git_commit_hash": "a1b2c3d",
    "test_status": "PASS (X/X)",
    "last_inspected_lines": "file.py: 12-45"
  },
  "components_validated": [
    "Validated and tested components"
  ],
  "next_step": "Immediate next step"
}
