# NATURAL task-envelope authorization consolidation

ADR-024-E consolidates one explicit human authorization around a bounded task
envelope. The envelope binds the objective, physical workspace identity,
capability vocabulary, risk ceiling, evidence-step ceiling, mutation policy,
validity interval and mandatory stop conditions.

Repeated R0 microreads may continue while every field remains contained. A
workspace change, new capability, increased risk, mutation, credential use,
external side effect, architectural decision, expiration or step overflow stops
and requires new human authority.

The envelope is containment evidence only. It cannot dispatch, create a grant,
approve itself, persist approval authority or change the canonical Orchestrator.
