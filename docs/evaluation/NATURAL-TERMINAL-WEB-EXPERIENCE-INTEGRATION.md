# NATURAL Terminal/Web Experience Integration

ADR-024-H qualifies one transport-neutral, presentation-only projection of the
NATURAL experience. The terminal and a future web renderer consume the same
immutable snapshot; neither receives an execution or mutation surface.

The snapshot exposes the active project, cognitive provider, privacy mode, work
mode, bounded conversation state, bounded task history and any pending human
authorization. It also names the stop, resume, clear-memory and provider-switch
controls without implementing those controls as authority.

The terminal commands `estado da experiência` and `experience status` cross the
same deterministic action and render Brazilian Portuguese or English labels.
The JSON web representation is a serialization of the same snapshot, not a
second orchestration path. All physical evidence, task authorization and effects
continue through the canonical Orchestrator.

Acceptance evidence is provided by:

- `tests/accelerator/natural-experience-surface.test.js`;
- `tests/accelerator/natural-cli-async-session.test.js`;
- `tests/accelerator/natural-session-control.test.js`.

The integration fails closed on malformed or oversized history and carries
explicit `operationalAuthority: false`, `mutationAuthority: false` and
`canonicalOrchestratorOnly: true` invariants.
