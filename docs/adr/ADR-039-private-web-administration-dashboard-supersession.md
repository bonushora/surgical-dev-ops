# ADR-039 — Private Web Administration Dashboard Supersession

- **Status:** ACCEPTED / FROZEN
- **Date:** 2026-09-01
- **Scope:** Privacy-preserving adoption telemetry administration interface
- **Decision authority:** Human
- **Supersedes:** ADR-015 §7 only with respect to the primary administration
  interface
- **Preserves:** All non-conflicting contracts of ADR-015

## Context

ADR-015 freezes the privacy-preserving adoption telemetry and public-presence
architecture. It places telemetry outside Surgical DevOps operational authority,
requires qualified aggregate measurement and data minimization, separates
private from public visibility, and keeps public metrics hidden until governed
qualification gates are satisfied.

ADR-015 §7 also selects a terminal-first, Linux-terminal surface as the primary
private administrative interface. The approved administration architecture now
requires a private web dashboard to be the primary administration and analytics
projection for telemetry. This is a conflict only about which interface is
primary; it is not authority to reopen the rest of ADR-015.

The existing `surgical-metrics` terminal projection is physical implementation
evidence, not a reason to modify runtime in this architectural decision.

## Problem

A private telemetry administration surface must be accessible to authorized
administrators through a browser without making the administrator's client
operating system part of the interface contract. It must remain a read-only
analytics projection over governed private metrics and must not become a new
control plane for Surgical DevOps.

The supersession must be narrow enough that changing the primary interface does
not weaken privacy, metric semantics, disclosure gating, failure isolation or
deterministic operational authority.

## Decision

The primary private administration and analytics interface for adoption
telemetry SHALL be a **Private Web Administration Dashboard**.

ADR-039 supersedes ADR-015 §7 only with respect to the primary administration
interface. ADR-015 remains authoritative for all non-conflicting telemetry,
privacy, metric semantics, public-presence gating and authority boundaries.

When interpreting the two decisions, ADR-039 has precedence only for the
question:

> What is the primary telemetry administration interface?

For that question, the private web dashboard is primary. A CLI MAY provide an
optional summarized projection, but the terminal is no longer the primary
administration or analytics dashboard.

No other part of ADR-015 is revoked. Any apparent conflict outside this single
interface question MUST fail closed and require a separate explicit
architectural decision.

## 1. Canonical architecture

The conceptual flow SHALL be:

```text
Surgical clients (Linux / Windows / macOS)
  -> minimal governed telemetry
  -> Telemetry Ingestion Boundary / API
  -> Private Metrics Store
       -> Private Surgical Administration Web Dashboard
       -> optional summarized CLI projection
       -> Privacy / Aggregation Gate
            -> future qualified public metrics surface
```

Telemetry is observational. It remains operationally separate from the
deterministic Surgical Orchestrator.

## 2. Private web administration dashboard

The dashboard SHALL:

- be accessible through a browser;
- remain independent of the administrator's client operating system;
- require authenticated and authorized administrative access;
- permit access from an appropriately authorized desktop or laptop browser;
- permit access from an appropriately authorized tablet or mobile browser where
  practical;
- consume governed telemetry or qualified private metrics;
- operate as a projection over qualified private metrics;
- remain read-only with respect to Surgical operational authority.

Browser accessibility does not make the dashboard public. Network reachability
does not constitute authorization. Authentication and authorization remain
required regardless of the administrator's device class.

## 3. CLI compatibility

The CLI MAY continue to expose a summarized, optional telemetry projection. The
existing `surgical-metrics` surface MAY remain as a compatibility or summary
interface.

The CLI is not the primary administration dashboard. Its current existence does
not qualify the private web architecture, and this ADR neither removes nor
modifies that runtime.

## 4. Authority boundary

The dashboard is not and MUST NOT become:

- the deterministic Orchestrator;
- mutation authority;
- a shell;
- a repository editor;
- Git authority;
- push authority;
- merge authority;
- tag authority;
- release authority;
- publication authority;
- deployment authority;
- provider authority;
- secret authority.

The dashboard, telemetry client, ingestion API, metrics database, aggregation
service, public metrics service and their network dependencies MUST NOT
authorize local mutation, workspace expansion, shell execution, Git mutation,
push, merge, tag, release, publication, deployment, provider switching, secret
access or authority expansion.

Administrative access is access to a governed metrics projection only. It does
not transitively grant any Surgical operational capability.

## 5. Failure isolation

Telemetry is best-effort, non-authoritative, privacy-constrained and
schema-versioned. The deterministic Orchestrator remains sovereign for
operational truth.

Dashboard, API, database, network, ingestion, aggregation or public-metrics
failure MUST NOT prevent normal Surgical operation. Telemetry MUST NOT become a
prerequisite for:

- local startup;
- governed workspace discovery;
- content-addressed mutation authority;
- mutation authority;
- qualification;
- journal or recovery;
- provider invocation;
- offline operation where otherwise supported.

No telemetry outage may grant, deny, broaden, reduce or weaken deterministic
operational authority.

## 6. Privacy and data minimization

ADR-015's privacy boundary remains authoritative. Telemetry collection SHALL be
limited to fields necessary for the qualified metric and SHALL use a versioned
schema.

Default telemetry MUST NOT transmit or collect:

- source code or arbitrary file contents;
- prompts, conversational content or mission content;
- provider request or response content;
- private diffs, patches or arbitrary repository content;
- filesystem paths;
- repository names, identities or URLs;
- hostnames, operating-system usernames or email addresses;
- secrets, tokens, API keys, credentials or private keys;
- arbitrary logs;
- non-schema fields or content not explicitly authorized by a future governed
  telemetry schema.

If a persistent installation identifier is used, it SHOULD be a random,
locally generated identifier such as a UUID. It MUST NOT be derived from a MAC
address, hardware serial, hostname, username, filesystem or repository
fingerprint, machine fingerprint, or secret material. Telemetry MUST NOT
silently evolve into fingerprinting.

## 7. Metrics semantics

Qualified private metrics MAY include:

- verified installations;
- active installations or users where the semantics are defensible;
- daily, weekly and monthly active measurements;
- D1, D7 or D30 retention;
- version and platform distribution;
- NATURAL, ENGINEER and EXPERT usage distribution;
- aggregate mission counts;
- aggregate authority-boundary interactions where privacy permits.

The following concepts are distinct and MUST NOT be collapsed for internal,
commercial or public claims:

```text
downloads
!= installations
!= verified installations
!= active installations
!= active users
```

An installation identifier is not automatically a person. Repeated activity
from one installation is not automatically multiple users. Any metric whose
semantics cannot be established reliably MUST remain qualified or unknown
rather than being presented as exact.

Linux, Windows and macOS clients MUST use equivalent metric semantics. Platform
implementation details MAY differ, but the meaning of an installation event or
active-install definition MUST NOT. Platform-specific filesystem or process
differences MUST NOT expand collected data silently.

## 8. Private and public separation

Private internal metrics and public metrics are separate governed projections.
The private dashboard MAY show exact internally qualified counts where privacy
policy permits.

Future public metrics MUST pass through a distinct Privacy / Aggregation Gate.
The public surface MUST NOT query or expose raw private telemetry records
directly. Public qualification SHOULD use aggregation, thresholding,
suppression, rounding or equivalent privacy-preserving controls as appropriate.

The public metrics block on `bonora.io` remains hidden initially. It MAY become
visible only after objective, predefined and governed adoption thresholds are
satisfied and qualified by the private backend. The private dashboard MAY exist
before any public metrics surface becomes visible.

This ADR does not invent numerical threshold values. Those values require
separate explicit authority unless already frozen by an applicable decision.

## 9. Security and privacy qualification

Future implementation qualification MUST prove both:

1. **Observability:** the telemetry system produces the intended qualified
   adoption metrics with stable cross-platform semantics.
2. **Confinement and privacy:** the telemetry system neither exfiltrates
   prohibited content nor acquires operational authority.

Qualification SHOULD attempt to make telemetry collect or transmit source code,
prompts, secrets, paths, repository identities, arbitrary logs, provider content
and other non-schema fields. The governed telemetry boundary MUST reject or
fail closed on those attempts.

Qualification MUST also prove that telemetry, ingestion, store, dashboard,
aggregation and public-surface outages do not break Surgical's deterministic
operation or weaken its authority model.

## 10. Vendor and implementation neutrality

This decision does not select a frontend framework, telemetry vendor, analytics
vendor, cloud, database or dashboard framework. No such dependency gains
architectural authority from this ADR.

Implementation of the web dashboard, ingestion service, metrics store,
authentication, aggregation or public metrics belongs to a separately
authorized future mission.

## 11. Relationship to existing ADRs

- **ADR-015 remains authoritative.** Only its §7 selection of a terminal-first
  primary private administrative interface is superseded. All non-conflicting
  privacy, telemetry, metric-semantics, public-presence gating and authority
  contracts remain frozen.
- **ADR-016 remains authoritative** for privacy-preserving aggregation,
  qualification and disclosure thresholds.
- **ADR-017 remains authoritative** for separating telemetry from billing and
  financial authority.
- **ADR-004, ADR-010, ADR-014, ADR-024, ADR-034 and ADR-038 remain
  authoritative** for deterministic authority, governed content and provider
  boundaries, and physical-state confinement.

This ADR creates no precedence over any of those decisions beyond the single
ADR-015 §7 interface question stated above.

## 12. Consequences and trade-offs

Benefits:

- administration is browser-accessible and independent of the administrator's
  client operating system;
- exact private analytics can remain distinct from qualified public claims;
- the terminal remains useful as a compact compatibility projection;
- the dashboard cannot become operational authority merely because it is an
  administrative interface.

Trade-offs:

- a future implementation requires governed authentication, authorization and
  web-service operations;
- private and public projections require an explicit aggregation boundary;
- browser availability adds network and service dependencies, which must remain
  failure-isolated from Surgical operation.

## 13. Non-goals

This ADR does not:

- implement telemetry clients, APIs, databases, stores, dashboards or CLI
  changes;
- modify `surgical-metrics`;
- implement authentication, aggregation, infrastructure or deployment;
- modify `bonora.io` or expose public metrics;
- select vendors, frameworks, clouds or databases;
- establish numerical public-adoption thresholds;
- grant any operational authority;
- revise any ADR-015 contract unrelated to the primary administration
  interface.

## 14. Acceptance contract

This decision is satisfied architecturally only when all of the following are
true:

- the private web dashboard is the documented primary telemetry administration
  and analytics interface;
- the CLI is documented as an optional summarized projection;
- authenticated and authorized browser access is required;
- the dashboard is a projection over qualified private metrics only;
- private data cannot flow directly into a public surface without the Privacy /
  Aggregation Gate;
- the `bonora.io` public metrics block remains hidden until governed thresholds
  are qualified;
- prohibited content is excluded by a versioned, data-minimized schema;
- Linux, Windows and macOS metric semantics are equivalent;
- outages cannot prevent normal Surgical operation or alter its authority;
- future qualification proves both observability and confinement/privacy;
- all non-conflicting ADR-015 contracts remain authoritative.

Documentation alone is architectural evidence, not implementation or runtime
qualification.

## 15. Frozen decisions and non-claims

Frozen decisions:

- ADR-015 continues in force.
- ADR-015 §7 is superseded only as to the primary administration interface.
- The private web dashboard is primary; the CLI is an optional summary.
- Telemetry and every telemetry projection remain observational and
  non-authoritative.
- Private and public metrics remain separated by governed privacy and
  aggregation qualification.
- Public metrics remain hidden until objective governed gates are met.
- Privacy, data minimization, semantic honesty, failure isolation, versioned
  schema and cross-platform meaning remain mandatory.

Non-claims:

- no web dashboard or supporting service is implemented by this ADR;
- no existing CLI behavior is removed or changed;
- no telemetry metric is claimed to be presently collected or qualified;
- no public threshold value is selected;
- no release, publication, deployment or operational authority is granted.
