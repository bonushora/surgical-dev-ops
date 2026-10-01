# Customer data boundary

Configuration, evidence, repository metadata, journals, authority material, and
credentials remain local by default. Local Ollama uses loopback only. An explicit
remote provider may receive only mediated prompts and bounded content selected by
the governed cognition boundary; credentials and Surgical authority material are
never provider input.

Production egress classes are provider-specific, optional telemetry, and optional
update access. Financial defaults deny all three until explicitly configured.
Blocked provider access fails explicitly and never falls back.

Sensitive-content inspection covers a bounded list of deterministic patterns;
it is not universal semantic secret classification. A no-match result is not an
egress authorization. Provider egress additionally requires an explicitly
authorized governed source, and unknown or unauthorized sources fail closed.
