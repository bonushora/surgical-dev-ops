# NATURAL governed persistent project memory

ADR-024-D introduces a distinct persistent data plane for project continuity.
Records are confined to one physical workspace identity and classified as a
frozen architectural decision, human preference, verified repository fact,
task state, or cognitive summary. Repository facts require evidence bindings;
cognitive summaries remain explicit non-authoritative hypotheses.

Memory can be inspected, corrected through record replacement, exported and
deleted. Secret-like content and an approval memory class fail closed. A changed
repository `HEAD` marks evidence-bound records stale. No memory record grants
approval, operational or mutation authority.

The storage adapter uses a project-identity filename beneath an explicitly
configured state root and atomic replacement. It rejects symbolic-link state
roots/files and oversized or cross-project state.
