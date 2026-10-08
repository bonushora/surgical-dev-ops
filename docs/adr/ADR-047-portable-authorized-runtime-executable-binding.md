# ADR-047 — Portable Authorized Runtime Executable Binding and Bounded Isolation Diagnostics

- Status: Accepted
- Date: 2026-10-08
- Related: ADR-009, ADR-038, ADR-042, ADR-046
- Qualification: `docs/evidence/GOVERNED-ISOLATED-RUNTIME-PORTABLE-BINDING-v0.1.md`

## Context

ADR-046 introduced the governed isolated Linux Bubblewrap runtime as a
defense-in-depth layer subordinate to existing Surgical DevOps authority. Its
local Linux structural and live qualification was green before canonical
promotion.

After promotion of commit
`e39467be208da2dcfd3135886dd23a5cdeff5c83`, GitHub Actions Ubuntu exposed a
portability defect. Real workloads assumed that the authorized Node executable
was physically available as `/usr/bin/node`, while the hosted runner supplied
Node from a hosted-toolcache path outside the sandbox-visible filesystem. The
Ubuntu run failed LIVE01 through LIVE12 and LIVE14 before workload semantics;
LIVE13 alone passed because it validates fail-closed behavior and the absence of
native fallback rather than successful Bubblewrap workload execution.

The diagnostic classified the narrow failure layer as
`H_CHILD_EXECUTABLE_NOT_VISIBLE`. Confidence remained `MEDIUM` before repair
because the tests did not emit the bounded Bubblewrap stderr already captured
and returned by the provider. The subsequent exact-runtime repair and green
Ubuntu hosted execution behaviorally corroborated the diagnosis; it does not
rewrite the historical diagnostic confidence.

## Decision

The authorized workload executable remains explicit in the existing execution
envelope. Executable authority does not come from `PATH` search, `which`, shell
lookup, or isolation itself.

Before execution, the runtime:

1. requires an explicit absolute executable path;
2. resolves its physical realpath deterministically, including symlink targets;
3. validates that the resolved target is a readable, executable regular file;
4. fails closed when resolution or validation fails;
5. uses the deterministic sandbox-visible path without additional exposure when
   the physical executable is already within a qualified read-only system
   runtime root; and
6. otherwise exposes only that exact physical executable as a read-only file at
   `/runtime/authorized-executable` and executes that guest path.

The parent runtime directory is not mounted. HOME, NVM, `/opt`, `/usr/local`,
hostedtoolcache, and equivalent broad trees are not exposed merely to locate an
authorized runtime. Existing qualified read-only system-library mounts continue
to supply required dynamic libraries.

The resolved host executable, guest executable path, binding mode, and effective
argv contribute to deterministic plan identity. Materially different executable
bindings therefore cannot silently share an indistinguishable plan digest.

This decision does not introduce a generic extra-mount facility. The model and
workload cannot select host mount sources. Isolation remains subordinate to
pre-existing authority, and provider unavailability or execution failure remains
fail-closed with no native fallback.

Tests may emit bounded and redacted failure evidence containing only:

- classification;
- exit code;
- signal;
- bounded stderr;
- plan digest; and
- redacted executable-binding metadata when necessary.

Diagnostics must not dump ambient environment variables, credentials, arbitrary
host filesystem contents, or unbounded command data.

## Security consequences

```text
AUTHORITY_MODEL_CHANGED=NO
NETWORK_DEFAULT=DENY
HOST_HOME_EXPOSED=NO
BROAD_RUNTIME_TREE_EXPOSED=NO
ARBITRARY_MOUNT_AUTHORITY_ADDED=NO
NATIVE_FALLBACK=NO
```

The exact external runtime binding is read-only. It does not make the host root
writable, expose the Docker socket, inherit ambient secrets, or add generic
shell authority. Runtime isolation remains an enforcement mechanism, not an
authority source.

## Rejected alternatives

- Installing `/usr/bin/node` only for CI is not an architectural portability
  solution and would leave the executable-location assumption intact.
- Mounting all of `/opt` is rejected because it needlessly expands host surface.
- Mounting all of `/usr/local` is rejected for the same reason.
- Exposing NVM or the host HOME is rejected because it reveals an unrelated
  runtime and user tree.
- Generic runtime-tree mounts are rejected because they create broader mount
  authority than the authorized executable requires.
- Treating a skipped live isolation test as a pass is rejected.
- Disabling live isolation checks is rejected because structural evidence does
  not replace physical containment qualification.

## Scope and nonclaims

This accepted decision documents the behavior qualified at
`42b179f820b31d0726dcf6aa776a9f5ee65addbb`. It does not enable isolated
execution by default, add production wiring, qualify a macOS or Windows
isolation backend, qualify OCI, VM isolation, or SuperSandbox, certify OWASP
compliance, prove containment of a hypothetical ASI, or authorize production
deployment.
