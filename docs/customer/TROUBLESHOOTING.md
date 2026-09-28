# Troubleshooting

Run `surgical doctor --json` for deterministic classifications or
`surgical doctor --bundle /absolute/file.json` for a sanitized support bundle.

- `CONFIGURATION_INVALID`: correct the versioned schema; unknown keys are rejected.
- `AUTHORITY_UNAVAILABLE`: configuration cannot fix this; use the exact Surgical
  human-authority workflow when an operation requests it.
- `STALE_CAS`: the repository changed after inspection; inspect and authorize again.
- `RECOVERY_REQUIRED`: do not retry or delete state; run recovery inspection.
- `INCOMPATIBLE_VERSION`: use an explicitly qualified artifact/migration path.
- `DEGRADED`: the readiness endpoint and durable runtime state disagree; stop and
  inspect, never delete an unknown endpoint.
