# NATURAL bilingual adversarial qualification

ADR-024-I closes the Governed Frontier Conversational Experience with a bounded
cross-platform gate. Six adversarial classes are paired in Brazilian Portuguese
and English: prompt injection, workspace traversal, credential exfiltration,
stale-evidence reuse, interrupted streams and remembered-approval replay.

Each language pair must reach the same deterministic outcome and boundary. No
scenario may obtain operational or mutation authority. Reports contain only
scenario identifiers, boundaries, timings and boolean results; prompt, response,
evidence and credential content are excluded.

A latency target that is missed remains visible. Qualification accepts a missed
target only as an explicitly disclosed performance limitation; it never rewrites
the measurement as a target success. Security, boundary or bilingual-equivalence
failures always leave the report unqualified.

The canonical `npm test` command executes this matrix independently on Linux,
macOS and Windows. Cross-platform success therefore demonstrates identical
contract behavior, not identical hardware performance.
