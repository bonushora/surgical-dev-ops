# NATURAL canonical presentation stream

ADR-024-B defines the deterministic boundary used to present acknowledgement,
progress and streamed cognitive text without creating operational authority.

## Contract

A stream is immutable, task-bound and fingerprinted. It accepts this order:

1. `ACKNOWLEDGED` exactly once;
2. zero or more `PROGRESS` or `CONTENT_DELTA` events;
3. exactly one terminal `COMPLETED` or `FAILED` event.

Every event is bound to the stream fingerprint, exact sequence and monotonic
observation. Events and accumulated text are bounded. Portuguese and English
text cross the same contract.

`CONTENT_DELTA` is presentation-only untrusted data. It always exposes:

```text
presentationOnly: true
operationalAuthority: false
mutationAuthority: false
```

`COMPLETED` is accepted only with a 64-character fingerprint for a separately
validated canonical result. The stream contract does not validate or execute
that result and exposes no filesystem, Git, process, shell, network, provider,
credential, approval or mutation dependency.

An interrupted, malformed, mismatched, non-monotonic, out-of-order or oversized
stream becomes terminal `FAILED`. A failed stream cannot later become completed.

## Qualification

Run the deterministic contract demonstration:

```bash
npm run evaluate:natural:stream-contract
```

Run its regression tests:

```bash
node --test tests/accelerator/natural-presentation-stream.test.js
```

The milestone qualifies the canonical presentation state machine. Provider
transport streaming remains disabled until a provider adapter separately
qualifies its identity, bounds, interruption behavior and final-result binding.
