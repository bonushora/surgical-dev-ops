# Human Acceptance — Customer-Operable Commercial Beta Candidate

Date: 2026-10-02

## Classification

**HUMAN_MANUAL_ACCEPTANCE = GREEN**

This record documents the product-owner manual acceptance required by
`docs/customer/MANUAL_ACCEPTANCE.md`.

The acceptance was performed interactively by the human operator against the
exact candidate artifacts identified below. Automation prepared this record but
did not sign, substitute, or manufacture the human acceptance.

## Exact candidate

### Surgical DevOps

- Version: `2.6.0-rc.6`
- Source commit: `2b735ceb67512f0ecfca951ced69b91ad3b64e31`
- Artifact SHA-256: `d65cf44eb7368bda565e6e5594ba46fb496d22e944c80ede01adca1e41ff2045`
- Artifact size: `804153` bytes
- Package entries: `219`

### Surgical AI Control Plane

- Version: `0.1.0-beta.1`
- Source commit: `6fc4baf4fd022fff9070d20d11be7c5f53cca024`
- Artifact SHA-256: `66b652706ec6c41ad60ab206a2df18be13f1798f7dd50bd0980708bcc2bba46b`
- Artifact size: `53247` bytes
- Package entries: `36`

## Manual acceptance result

| Step | Result |
|---|---|
| 1 — install exact artifact | GREEN |
| 2 — init developer | GREEN |
| 3 — doctor/start/status | GREEN |
| 4 — disposable repository/open | GREEN |
| 5 — NATURAL objective | GREEN |
| 6 — bounded approval proposal | GREEN |
| 7 — exact one-shot authorization | GREEN |
| 8 — physical result/test evidence | GREEN |
| 9 — journal/evidence correlation | GREEN |
| 10 — exact replay, zero duplicate effect | GREEN |
| 11 — restart/recovery, no authority resurrection | GREEN |
| 12 — stop/uninstall, evidence preserved | GREEN |

## High-value physical evidence

- Proposal fingerprint:
  `ee28b5c77ffddd4251626b32fb2f331db55941e7a9e352d2405b9c455c52404d`
- Transaction:
  `39d8591f5eef6348bca6a1b5202f835aa6aeddce8d1b51c4c2f51a214091c3b6`
- Source BEFORE SHA-256:
  `572da4b03d73a6d67bf9effcb363c5885f2ce5557ea0280df5e831294fc1c4b9`
- Authoritative projection AFTER SHA-256:
  `95b2d074cdfb139e37fa38565f5b6078499afcf3f1b97aa19d33f10887cc0f3b`
- Mutation journal records: `9`
- Authorization-consumption records: `1`
- Physical effects: `1`
- Replay physical effects: `0`
- Final worktree: `CLEAN`
- Restart/recovery: `GREEN`
- Authority resurrected after restart: `false`
- Uninstall: `RUNTIME_REMOVED`
- Evidence preserved: `true`
- Repository untouched: `true`

## Qualification boundary

This acceptance qualifies the exact artifacts above as the frozen
**Customer-Operable Commercial Beta Candidate** for this campaign.

It does **not** authorize or claim:

- production enablement;
- general availability;
- stable release;
- completed external review;
- independent audit;
- public exposure;
- absolute security;
- regulatory certification.

The next gate remains external engineering/adversarial review under ADR-025.
