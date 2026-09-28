# Product-owner manual acceptance (10–15 minutes)

Use only a disposable directory and the exact qualified artifact/hash. Record
PASS or FAIL for every step; automation must not sign this acceptance.

1. Install the artifact. **EXPECTED:** installation completes without a source
   checkout and `surgical version --json` shows v1/v2 only. **PASS / FAIL:** PASS
   only if versions and artifact identity are understandable.
2. Run `surgical init --profile developer`. **EXPECTED:** private state is created
   and no authority or production eligibility is granted. **PASS / FAIL:** PASS if
   the message makes both distinctions clear.
3. Run `surgical doctor` and `surgical start`, then `surgical status`.
   **EXPECTED:** diagnostics are actionable and READY appears only after IPC proof;
   authority remains unavailable. **PASS / FAIL:** PASS if status is comprehensible.
4. Create a disposable Git repository and run `surgical open <absolute-path>`.
   **EXPECTED:** branch/HEAD/worktree are recognized; authority remains absent.
   **PASS / FAIL:** PASS if onboarding is clear and non-authorizing.
5. In the normal NATURAL surface, submit “Corrija os testes que estão falhando.”
   **EXPECTED:** objective, bounded plan, evidence, and proposed scope appear before
   mutation. **PASS / FAIL:** PASS if no internal payload transfer is requested.
6. Review the approval prompt. **EXPECTED:** operation, reason, target, repository,
   BEFORE/AFTER, risk, duration/scope, and excluded powers are explicit.
   **PASS / FAIL:** PASS only if one bounded authorization is understandable.
7. Grant that exact authorization. **EXPECTED:** Surgical independently validates
   it and performs one real governed physical effect. **PASS / FAIL:** PASS if the
   effect and authority ownership are visible.
8. Inspect diff/test output. **EXPECTED:** intended change and GREEN/RED evidence are
   distinct from model prose. **PASS / FAIL:** PASS if outcome is unambiguous.
9. Run `surgical evidence`. **EXPECTED:** request→authority→CAS→journal→terminal
   correlation is readable and credential-free. **PASS / FAIL:** PASS if auditable.
10. Repeat the exact operation. **EXPECTED:** zero duplicate physical effect.
    **PASS / FAIL:** PASS only if replay suppression is explicit.
11. Run `surgical restart`, `surgical status`, and `surgical recovery`.
    **EXPECTED:** state reconciles without automatic resubmission. **PASS / FAIL:**
    PASS if no authority is resurrected.
12. Run `surgical stop` and `surgical uninstall`. **EXPECTED:** endpoint stops;
    repository/evidence remain. **PASS / FAIL:** PASS if no customer data is silently
    destroyed.

Any FAIL keeps human acceptance open. Do not use a real production repository.
