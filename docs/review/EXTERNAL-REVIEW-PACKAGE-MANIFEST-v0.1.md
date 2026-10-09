# External Review Package Manifest v0.1

```text
REVIEW_PACKAGE_VERSION=v0.1
CANONICAL_BASE_SHA=f45720e40ee0c9d0d0a5e5bcf34dcee5e9c18b8f
PRODUCTION_WIRING=NO
AUTHORITY_MODEL_CHANGED=NO
```

The base SHA identifies the canonical documented runtime used to prepare this
package. The final review-package SHA and exact-SHA CI run are external runtime
evidence and must not be self-referentially written back into the commit they
qualify.

## Reviewer entry points

| Purpose | Exact repository path |
| --- | --- |
| Start here | `docs/review/REVIEWER-START-HERE.md` |
| R1–R15 readiness matrix | `docs/review/EXTERNAL-ENGINEERING-REVIEW-READINESS-v0.1.md` |
| Package manifest | `docs/review/EXTERNAL-REVIEW-PACKAGE-MANIFEST-v0.1.md` |
| Demo instructions | `examples/external-review/README.md` |
| Demo implementation | `examples/external-review/run-review-demo.js` |
| Two-run machine verifier | `examples/external-review/verify-review-demo.js` |
| Canonical demo test | `tests/accelerator/external-review-demo.test.js` |

## Architecture and qualification records

| Evidence | Exact repository path |
| --- | --- |
| Governed isolated execution decision | `docs/adr/ADR-046-governed-isolated-execution-runtime.md` |
| Portable executable binding decision | `docs/adr/ADR-047-portable-authorized-runtime-executable-binding.md` |
| Portable binding RED→GREEN qualification | `docs/evidence/GOVERNED-ISOLATED-RUNTIME-PORTABLE-BINDING-v0.1.md` |
| External engineering review history | `docs/EXTERNAL_ENGINEERING_REVIEW.md` |
| Boris review acknowledgement | `docs/review/EXTERNAL_REVIEW_ACKNOWLEDGEMENTS.md` |
| Yasha/AGMI persisted-record evidence and limitations | `docs/review/AGMI-STORE-HARDENING-v1.md` |
| Containment qualification | `docs/evidence/BH-CONTAINMENT-QUALIFICATION.md` |
| Containment hardening record | `docs/evidence/BH-CONTAINMENT-HARDENING-V2.md` |

## Primary implementation boundaries for inspection

- `accelerator/core/execution-isolation/runtime-profile.js`
- `accelerator/core/execution-isolation/execution-envelope.js`
- `accelerator/adapters/linux-bwrap-execution-provider.js`
- `accelerator/core/capability-grant.js`
- `accelerator/core/surgical-orchestrator.js`
- `accelerator/core/git-manifest-cas.js`
- `accelerator/core/mutation-transaction.js`
- `accelerator/core/mutation-recovery.js`
- `accelerator/cli/natural-development-authorization-consumption.js`

## Relevant qualification tests

- `tests/accelerator/execution-isolation-structural.test.js`
- `tests/accelerator/execution-isolation-live.test.js`
- `tests/accelerator/external-review-demo.test.js`
- `tests/accelerator/capability-grant.test.js`
- `tests/accelerator/human-identity-assertion.test.js`
- `tests/accelerator/natural-mission-scoped-mutation-authority-adversarial.test.js`
- `tests/accelerator/natural-development-g9-g10-crash-window-adversarial.test.js`
- `tests/accelerator/natural-development-agmi-store-hardening.test.js`
- `tests/accelerator/natural-development-production-antireplay-integration.test.js`
- `tests/accelerator/natural-development-workspace-substitution-adversarial.test.js`
- `tests/accelerator/git-manifest-cas.test.js`
- `tests/accelerator/mutation-recovery.test.js`

## Reproduction

Primary command from a clean checkout:

```bash
npm ci
npm run review:external:demo
```

The verifier checks every manifest path, executes two fresh physical Linux
Bubblewrap demonstrations, and requires identical normalized security digests.
The canonical suite then exercises the same verifier on Linux. macOS and Windows
assert an explicit `UNSUPPORTED_PLATFORM` compatibility outcome and do not
claim isolation qualification.

## Package boundary and nonclaims

This package changes no production runtime, authority semantics, Control Plane,
SuperSandbox, protocol RAW, default execution path, or isolation enablement. It
does not constitute third-party review completion, certification, OWASP
certification, universal agent safety, ASI containment, macOS/Windows isolation
qualification, or production-deployment authorization.
