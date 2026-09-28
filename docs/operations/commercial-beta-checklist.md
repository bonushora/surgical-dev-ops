# Commercial Beta engineering checklist

Classification is deterministic. A checked item must cite evidence at the exact final commit; otherwise it remains unchecked.

- [ ] Complete Surgical DevOps local suite GREEN at final SHA.
- [ ] Complete Control Plane local suite GREEN at final SHA.
- [ ] Complete Surgical DevOps native suite GREEN on `ubuntu-latest`, `macos-15`, and `windows-latest` at final SHA.
- [ ] Complete Control Plane native suite GREEN on `ubuntu-latest`, `macos-15`, and `windows-latest` at final SHA.
- [ ] Cross-repository v1 non-physical and v2 governed physical E2E GREEN on all three platforms against the exact final Surgical SHA.
- [x] Local split-brain campaign proves at most one same-domain physical effect and fail-closed ownership substitution.
- [ ] Crash/recovery campaign covers every published fault boundary without an unresolved automatic-recovery gap.
- [x] Production physical mode is disabled by default.
- [x] Explicit production enablement distinguishes implementation availability,
  configured deployment eligibility, operation eligibility, current Surgical
  authority, and exact-operation readiness without changing frozen v1/v2.
- [x] Configuration, environment, discovery, workspace opening, and Control
  Plane approval cannot grant physical authority.
- [x] Orphan registry-writer recovery is evidence-driven, one-shot-authorized,
  exclusively claimed, exact-CAS protected, and durably published without
  timeout/PID takeover.
- [x] Operator guarantees and non-guarantees are documented.
- [x] Package dry-run completes without publishing.
- [ ] Credential and generated-artifact scans are clean at final SHA.
- [ ] Both final worktrees are clean and exact remote SHAs match.

Hard blockers for opening productization are exact Surgical-owned physical
authority, explicit safe production configuration, exact operation authority,
deterministic authorized writer recovery, zero-effect replay, cross-platform
protocol qualification, and absence of an unauthorized physical-effect path.

Allowed Commercial Beta limitations are active in-flight atomic cancellation,
universal power-loss immunity beyond qualified platform primitives, stronger
future host/process authentication, and the absence of push/merge/release/deploy
authority.

Current deterministic classification remains **NOT COMMERCIAL-BETA READY**
until the unchecked exact-final-SHA local/native/publication evidence above is
physically GREEN.

The remaining unchecked items are evidence gates, not permission for customer
productization. This is not a GA or production-ready claim.
