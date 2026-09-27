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
- [ ] Explicit production enablement distinguishes implementation, v2 availability, configured mode, and current human authority without changing a frozen protocol silently.
- [x] Operator guarantees and non-guarantees are documented.
- [x] Package dry-run completes without publishing.
- [ ] Credential and generated-artifact scans are clean at final SHA.
- [ ] Both final worktrees are clean and exact remote SHAs match.

Current deterministic classification: **NOT COMMERCIAL-BETA READY**.

Blocking items include final native qualification and the unqualified production-enablement/orphan-registry-lock recovery boundaries. This is not a GA or production-ready claim.
