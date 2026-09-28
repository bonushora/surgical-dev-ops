# Upgrade

`surgical upgrade` performs a read-only compatibility check. Stop the runtime,
back up qualified non-authority state, run the check, verify the supplied
artifact hash, then install that artifact with the same package manager used for
installation. `surgical upgrade --apply` remains fail-closed because the beta
has no signed automatic-update channel. Upgrade is blocked while the runtime is
active or recovery is required; the qualified core separately blocks mutation
and ownership ambiguity.

State migrations must be explicit and versioned. Unknown newer state fails
closed. Journal, authority, and recovery evidence are never silently rewritten.
