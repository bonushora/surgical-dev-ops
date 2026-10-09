# External engineering review demonstration

This directory contains `REVIEW_DEMONSTRATION_HARNESS`, a test/demo-only
composition of the existing governed execution-envelope, runtime-profile, and
Linux Bubblewrap provider APIs. It is not a production execution path and does
not wire isolation into NATURAL, ENGINEER, EXPERT, Control Plane, or the default
orchestrator.

```text
PRODUCTION_WIRING=NO
ISOLATION_IS_AUTHORITY=NO
```

## Prerequisites

- Linux;
- Node.js compatible with the repository `engines` declaration;
- `/usr/bin/bwrap` with the namespace and mount capabilities required by
  ADR-046; and
- repository dependencies installed from the lockfile.

The physical demo must run in a host context that permits unprivileged user,
mount, PID, IPC, UTS, and network namespaces. A container or managed command
sandbox may deny those capabilities even when the host itself supports them.
Such denial is a failed physical prerequisite, not a passing or skipped
containment result.

## Primary reproduction command

From the repository root:

```bash
npm ci
npm run review:external:demo
```

The verifier creates fresh disposable fixture state twice, runs the complete
demo twice, compares normalized security evidence, and exits non-zero if any
required check fails or is skipped. It writes no repository file.

For one machine-readable run:

```bash
node examples/external-review/run-review-demo.js
```

Successful output uses schema `sdo.external-review-demo/v1`; two-run
verification uses `sdo.external-review-demo-verification/v1`. Security digests
exclude timestamps, random fixture names, local absolute paths, and raw plan
digests. The harness still verifies that every provider result is bound to its
issued plan digest.

## Demonstrated boundary

```text
HUMAN-BOUNDED REVIEW INPUT
  -> fixed pre-authorized fixture labels (human signing is not demonstrated)
  -> existing normalized runtime profile
  -> existing authorized execution envelope
  -> exact repository/workspace evidence labels
  -> deterministic Bubblewrap execution plan
  -> exact external executable read-only binding
  -> authorized /workspace effect succeeds
  -> unauthorized host effects fail closed
  -> bounded machine-readable evidence and digest
```

There is currently no single production path joining that complete sequence.
The harness deliberately composes already-qualified support APIs for review.
The reviewer authorizes execution of the demo command; its fixed fingerprints
are evidence labels, not newly minted human authority. It does not create,
amplify, transfer, consume, or restore authority.

## Required checks

- authorized workspace write succeeds;
- host sentinel read and write are denied;
- host HOME and sibling workspace are absent;
- ambient sentinel, Docker socket, and host loopback are unavailable;
- workspace symlink escape and system-path mutation are denied;
- an unavailable Bubblewrap backend fails before workload execution;
- an invalid executable is rejected before plan execution;
- an external runtime is exposed as only one exact read-only file at
  `/runtime/authorized-executable`;
- the external runtime parent and sibling sentinel remain absent;
- no native fallback occurs; and
- result evidence remains bound to the issued plan digest.

On macOS or Windows the standalone physical command returns
`UNSUPPORTED_PLATFORM`. That result is compatibility information only and is
not isolation qualification for either platform.
