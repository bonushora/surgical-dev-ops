# Recovery

`surgical recovery` reports whether reconciliation or recovery is required. An
ambiguous physical delivery is never automatically resubmitted. Restart reads
durable evidence and reconciles; unknown remains unknown.

Do not edit journals or locks. Corrupt, contradictory, or unsupported state fails
closed. Active in-flight atomic mutation is non-interruptible in this beta.
