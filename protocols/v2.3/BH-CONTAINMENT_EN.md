# BH-CONTAINMENT extension for BH-SEP v2.3 + BH-SDP v2.3

## Normative scope

This extension applies together with the normative RAW files
[`BH-SEP.md`](./BH-SEP.md) and [`BH-SDP.md`](./BH-SDP.md). Historical RAW files
and derived copies remain byte-for-byte unchanged. Loading only a legacy RAW
file or only the BH-SEP/BH-SDP composition does not load this extension.

## Containment rules

1. Protected actions may start only after the host loader validates the
   version, path, and SHA-256 of every active-profile component against anchors
   embedded in the trusted runtime.
2. The containment profile does not inherit authority from a snapshot,
   manifest, previous session, or legacy profile. A missing, changed,
   incompatible, or invalid component blocks the operation before launch.
3. Every external transport must fix its destination, operations, methods,
   paths, limits, and headers. A fixed destination does not authorize arbitrary
   operations. Opaque channels, including WebSocket without a qualified parser,
   are rejected before application bytes can reach the upstream.
4. Privileged credentials remain on the host. The sandbox may receive only a
   non-privileged session-specific identity validated by the broker, which
   injects authentication solely for the fixed destination. Modes without
   proven mediation remain blocked, with no permissive fallback.
5. Content inspection is heuristic and bounded; no match does not certify the
   universal absence of a secret. Egress also requires a source explicitly
   authorized by policy held outside agent-writable state. Unknown or
   unauthorized sources are blocked.
6. Safe refusal, native isolation, and provider functionality are independent
   dimensions. Blocking an unsafe channel does not prove functional operation.
7. The profile grants no operational, mutation, publication, credential, or
   scope-expansion authority and makes no claim to contain every present or
   future AI system.

## Identifier

`BH-SEP-v2.3+BH-SDP-v2.3+BH-CONTAINMENT-v1`
