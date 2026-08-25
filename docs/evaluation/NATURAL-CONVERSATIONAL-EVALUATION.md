# NATURAL conversational evaluation

ADR-024-A establishes the executable contract used to compare NATURAL cognitive
profiles without granting the evaluation layer operational authority.

## Canonical scenarios

The harness includes four immutable project-explanation scenarios:

- Brazilian Portuguese, cold decision;
- English, cold decision;
- Brazilian Portuguese, exact evidence-bound cache reuse;
- English, exact evidence-bound cache reuse.

Portuguese and English require their language-specific canonical README. The
runner must report a complete authority-free observation and emit the ordered
presentation stages `ACKNOWLEDGED`, `FIRST_CONTENT`, and `COMPLETED`.

## Metrics and gates

The report measures:

- acknowledgement latency;
- first-content latency;
- total completion latency;
- expected cache behavior;
- language equivalence;
- canonical evidence target grounding;
- response completeness;
- required project concepts;
- absence of operational and mutation authority.

A failed latency or quality target remains an explicit failed result. The harness
does not alter a provider, retry a task, execute an operation, or manufacture a
qualified result.

## Privacy

Reports contain profile identifiers, scenario identifiers, numeric metrics and
boolean outcomes only. They do not contain prompts, responses, evidence content,
credentials, secrets or hidden reasoning. Evaluation content exists only inside
the caller-supplied scenario runner and is discarded after scoring.

## Contract demonstration

Run the deterministic contract demonstration with:

```bash
npm run evaluate:natural:contract
```

This command does not invoke Ollama, an external provider, the filesystem, Git,
the Orchestrator or a mutation path. It demonstrates the report schema using a
fixed in-memory runner and clock.

Real provider qualification must supply a separately governed runner that maps
the existing NATURAL presentation and cognitive boundaries into this harness.
Adding that runner does not change the evaluation contract and cannot grant the
provider operational authority.
