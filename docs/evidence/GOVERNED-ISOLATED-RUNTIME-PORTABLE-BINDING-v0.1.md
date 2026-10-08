# Governed Isolated Runtime — Portable Runtime Binding Qualification v0.1

- Project: `SURGICAL_DEVOPS`
- Campaign: `PORTABLE_EXACT_RUNTIME_BINDING_RED_TO_GREEN_V01`
- Qualification date: 2026-10-08
- Decision: ADR-047

## 1. Objective

Permanently record the bounded repair and exact-SHA qualification that removed
the `/usr/bin/node` location assumption from the governed Linux Bubblewrap
provider without expanding runtime authority or broadening host filesystem
visibility.

## 2. Initial RED condition

```text
BASE_SHA=e39467be208da2dcfd3135886dd23a5cdeff5c83
CI_RUN=37826115712
CI_UBUNTU=FAIL
CI_MACOS=PASS
CI_WINDOWS=PASS

LIVE01-LIVE12=FAIL
LIVE13=PASS
LIVE14=FAIL
```

Thirteen of fourteen initial Ubuntu live cases failed before workload semantics.
LIVE13 passed only because it intentionally validates unavailable-backend
fail-closed behavior and the absence of native fallback; it does not require a
successful Bubblewrap workload.

The macOS and Windows results demonstrated canonical compatibility only. They
did not qualify an isolated-runtime backend on either platform.

## 3. Diagnostic result

```text
FAILURE_LAYER=H_CHILD_EXECUTABLE_NOT_VISIBLE
DIAGNOSTIC_HYPOTHESIS=HOSTED_NODE_RUNTIME_PATH_IS_OUTSIDE_THE_BWRAP_VISIBLE_FILESYSTEM_WHILE_TESTS_HARDCODE_/usr/bin/node
ROOT_CAUSE_CONFIDENCE=MEDIUM
```

Local Linux used an executable visible through the qualified system mounts,
while GitHub Actions selected Node from hosted tooling outside the original
`/usr/bin/node` assumption. The provider captured and returned bounded stderr,
but the live assertions did not emit it, so the pre-repair diagnosis correctly
remained medium-confidence. The successful targeted repair and subsequent
Ubuntu green execution behaviorally corroborated this diagnosis; it does not
retroactively change the historical confidence to high.

## 4. Repair

```text
REPAIR_SHA=42b179f820b31d0726dcf6aa776a9f5ee65addbb
REPAIR_COMMIT_MESSAGE=fix(isolation): bind authorized runtime executable portably
REPAIR_BRANCH=fix/isolated-runtime-portable-executable-binding
PROMOTION_TYPE=STRICT_FAST_FORWARD
PUSH_COUNT=1
FORCE_PUSH=NO
SECOND_PUSH=NO
```

The repair canonicalizes and validates the explicit executable, resolves
symlinks to a deterministic physical target, and rejects missing, non-file, or
non-executable targets. An executable outside qualified read-only system roots
is exposed as one exact read-only file at
`/runtime/authorized-executable`. Its parent runtime tree is not mounted. The
physical and guest mapping contributes to the deterministic execution-plan
digest.

This is a closed executable-binding mechanism, not a generic filesystem mount
facility. It adds no `PATH`-derived authority, generic extra mounts, broad HOME,
NVM, `/opt`, `/usr/local`, or hostedtoolcache exposure, and no native fallback.

Failure assertions now emit bounded and redacted diagnostics consisting of
classification, exit code, signal, bounded stderr, and plan digest without
dumping ambient environment variables, credentials, or arbitrary host data.

```text
EXACT_RUNTIME_BINDING=YES
EXACT_RUNTIME_BINDING_READ_ONLY=YES
BROAD_PARENT_RUNTIME_TREE_EXPOSED=NO
STDERR_CAPTURED_BY_PROVIDER=YES
STDERR_RETURNED_TO_TEST=YES
STDERR_EMITTED_ON_TEST_FAILURE=YES_BOUNDED_REDACTED
```

## 5. Local qualification

The developer-specific runtime path is normalized in this permanent record:

```text
LOCAL_PROCESS_EXEC_PATH=<user-home>/.nvm/versions/node/v24.18.0/bin/node
LOCAL_PROCESS_EXEC_REALPATH=<user-home>/.nvm/versions/node/v24.18.0/bin/node
PATH_NORMALIZED_FOR_DOCUMENTATION=YES

STRUCTURAL=38/38/0
LIVE=15/15/0
LIVE_SKIP=0

FULL_TESTS_TOTAL=1680
FULL_TESTS_PASS=1671
FULL_TESTS_FAIL=0
FULL_TESTS_SKIP=9

PORTABLE_EXTERNAL_EXECUTABLE_TEST=PASS
UNAUTHORIZED_HOST_MUTATIONS=0
```

The external-runtime test copied an executable into disposable state, authorized
only that file, proved that it executed, and proved that its parent directory and
non-sensitive sibling sentinel were not visible.

## 6. Remote qualification

```text
CI_EXACT_SHA=42b179f820b31d0726dcf6aa776a9f5ee65addbb
CI_RUN=37832994354
CI_UBUNTU=PASS
CI_MACOS=PASS
CI_WINDOWS=PASS
CI_GREEN=YES

UBUNTU_BWRAP_PROBE=PASS
UBUNTU_LIVE_EXECUTED=15
UBUNTU_LIVE_PASS=15
UBUNTU_LIVE_FAIL=0
UBUNTU_LIVE_SKIP=0
UBUNTU_REAL_WORKLOAD_EXECUTION=PASS

MACOS_ISOLATED_RUNTIME_QUALIFIED=NO
WINDOWS_ISOLATED_RUNTIME_QUALIFIED=NO
```

Ubuntu used Node 24.18.0 from a hosted-toolcache runtime outside the original
`/usr/bin/node` assumption. Successful execution demonstrates the portable
exact-file binding; it does not mean the hosted-toolcache tree or another broad
host path became visible. macOS and Windows passed the canonical regression
matrix only.

## 7. Security invariants

```text
AUTHORITY_MODEL_CHANGED=NO
CONTROL_PLANE_CHANGED=NO
DEFAULT_EXECUTION_PATH_CHANGED=NO
PRODUCTION_WIRING=NO

NETWORK_DEFAULT=DENY
HOST_ROOT_WRITABLE=NO
HOST_HOME_EXPOSED=NO
BROAD_HOME_TREE_EXPOSED=NO
BROAD_OPT_TREE_EXPOSED=NO
BROAD_USR_LOCAL_TREE_EXPOSED=NO
DOCKER_SOCKET_EXPOSED=NO
AMBIENT_SECRETS_INHERITED=NO

GENERIC_SHELL_AUTHORITY_ADDED=NO
ARBITRARY_MOUNT_AUTHORITY_ADDED=NO
ISOLATION_IS_AUTHORITY_SOURCE=NO
NATIVE_FALLBACK_ON_ISOLATION_FAILURE=NO

RAW_V2_3_CHANGED=NO
RAW_V2_4_CHANGED=NO
```

The pre-existing qualified read-only system roots were preserved; no new broad
runtime-tree exposure was added to locate Node. Isolation remains subordinate to
the pre-existing execution authority.

## 8. Nonclaims

- Isolated execution is not enabled by default.
- No production wiring was added.
- The macOS isolated-runtime backend is not qualified.
- The Windows isolated-runtime backend is not qualified.
- macOS and Windows results demonstrate canonical compatibility only.
- OCI is not qualified.
- VM isolation is not qualified.
- SuperSandbox is not qualified.
- This is not OWASP certification.
- This does not prove containment of a hypothetical ASI.
- This does not authorize production deployment.
- No tag, GitHub Release, npm publication, or deployment was created.

## 9. Final state

```text
TAG_CREATED=NO
RELEASE_CREATED=NO
NPM_PUBLISHED=NO
FINAL_STATE=GREEN_PORTABLE_RUNTIME_REMOTE_CI
```

Commit `42b179f820b31d0726dcf6aa776a9f5ee65addbb` was promoted to canonical
`main` as one strict fast-forward push and qualified by automatic exact-SHA CI
run `37832994354` on Ubuntu, macOS, and Windows.
