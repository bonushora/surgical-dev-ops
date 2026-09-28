# Backup and restore

Backup is allowed only while stopped. The qualified beta backup contains
configuration, repository enrollment metadata, and customer evidence. It excludes
credentials, secrets, human authority, consumed authorizations, and mutation
journals. The backup carries an integrity digest.

Restore refuses existing state and validates schema and integrity. Restored data
cannot resurrect physical or recovery authority. Journal-grade disaster recovery
requires a future separately qualified design.
