# NATURAL durable asynchronous task state

ADR-024-F introduces a bounded, project-confined and integrity-checked task
state that can survive a process restart. A task records explicit progress,
stop, failure, completion and exact committed-effect fingerprints in a chained
immutable transition history.

Resume requires the same physical workspace, the exact original task-envelope
authorization and unexpired authority. Silence is never success. Terminal tasks
cannot resume, and an effect whose durable fingerprint is already present cannot
be applied again.

The state machine and store do not dispatch work, execute processes, access the
network, grant authority or perform project mutation. Monitoring remains
read-only; commits, pushes, reruns, releases and messages remain separate governed
side effects.
