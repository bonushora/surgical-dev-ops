# ADR-042 first RED evidence

- Date: 2026-09-27
- Parent: `490c1ab9c31c417cfa1df34d4208930b8abb323e`
- Branch: `feature/control-plane-governed-physical-v2`
- Command: `node --test tests/accelerator/control-plane-physical-v2-first-red.test.js`
- Tests: 8
- Passed: 1
- Failed: 7
- Cancelled: 0
- Skipped: 0

The existing v1 non-physical invariant passed, including the frozen digest
`cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935`
and `physicalDispatchEnabled === false`.

All seven v2 expectations failed before production implementation because
`accelerator/core/control-plane-protocol-v2.js` did not exist. The RED was
therefore caused by the absent feature, not by breaking qualified v1 code.

Covered expectations:

1. v1 cannot physically mutate;
2. v2 without a governed executor reports physical dispatch disabled;
3. exact local Surgical authority is required;
4. stale repository/CAS cannot write;
5. Control Plane references cannot mint Surgical authority;
6. a valid pre-authorized v2 mutation needs a physical implementation path;
7. identical replay cannot execute twice;
8. ambiguous failure cannot trigger automatic resubmission.
