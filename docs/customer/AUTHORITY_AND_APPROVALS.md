# Authority and approvals

Surgical DevOps is the sole physical authority owner. The Control Plane and CLI
may present an exact request but cannot mint the grant. An approval must bind the
operation, workspace, repository, HEAD, target, BEFORE/AFTER hashes, risk,
expiration, and one-shot or mission scope.

An approval never includes push, merge, release, deployment, arbitrary shell,
generic filesystem access, or generic network authority. Consumed authority is
never silently reused. Natural-language intent alone is not approval.
