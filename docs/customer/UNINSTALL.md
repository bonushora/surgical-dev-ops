# Uninstall

Stop the runtime, then run `surgical uninstall`. Default removal clears only
owned runtime metadata and preserves configuration, evidence, journals, and
repository enrollment. Customer repository content is never touched.

After that check succeeds, remove the executable with the same package manager
used for installation (for example, `npm uninstall --global surgical-dev-ops`).
This second step removes the artifact, not the preserved customer state root.

`--purge-data` is intentionally unavailable until a separately qualified,
explicit destructive workflow exists. Ambiguous physical state is never deleted
to make uninstall appear successful.
