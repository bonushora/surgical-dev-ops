# ADR-043 first RED evidence

- Date: 2026-09-28
- Parent: `397115d362707919d8f493b119d3efda0177ea43`
- Branch: `feature/control-plane-commercial-beta-gate-v1`
- Command: `node --test --test-concurrency=1 tests/accelerator/control-plane-production-enablement.test.js tests/accelerator/control-plane-registry-writer-recovery.test.js`
- Tests: 2 file-level failures
- Passed: 0
- Failed: 2
- Cancelled: 0
- Skipped: 0

Both files failed at module loading because the production-enablement state
machine and registry-writer recovery adapter did not exist. The RED therefore
identified the two missing architectural surfaces rather than a regression in
frozen v1/v2 behavior.

The resulting focused GREEN covers disabled/configured production,
operation-bound authority mismatches, stale CAS, environment/configuration and
Control Plane approval non-authority, exact one-shot authority and replay, all
published orphan stages, absent/contradictory evidence, malformed/symlink
ownership, binding/generation/authorization substitution, recovery CAS, and
two recovery actors.
