# BH-CONTAINMENT Hardening & Qualification Patch v2

## Frozen decision

This patch keeps WebSocket `BLOCKED_BEFORE_UPGRADE`. WebSocket functionality is
a separate future RED→GREEN campaign and must not be enabled as a side effect of
provider qualification.

## What this patch hardens

1. Replaces the scattered component map as the primary update surface with one
   immutable containment manifest whose SHA-256 is embedded in the trusted
   runtime.
2. Adds an anti-rollback `generation` gate.
3. Makes the WebSocket denial policy part of the trusted manifest contract.
4. Adds an explicit, opt-in real-provider qualification probe. Absence of opt-in
   remains `NOT_EXECUTED`; lack of credentials is `BLOCKED`.
5. Keeps platform-specific containment claims honest: Linux may retain its
   previously observed native PASS, while macOS/Windows remain `NOT_EXECUTED`
   until physical qualification evidence exists.

## Residual boundary

This does not remove the trusted host/runtime from the trusted computing base.
It strengthens tamper and rollback detection inside that boundary. Compromise of
the trusted runtime itself remains outside the claim.

A successful CI run does not by itself promote real-provider or platform-native
physical qualification. Those dimensions require their corresponding evidence.
