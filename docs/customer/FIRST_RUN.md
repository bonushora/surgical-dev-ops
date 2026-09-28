# First run

`surgical init --profile developer|enterprise|financial` creates a private,
versioned state root. It is restart-safe and refuses unexplained or incompatible
state. Initialization creates configuration, runtime, journal, evidence, log,
backup, and repository-registry directories only.

Initialization does not create human authority, enable production, enroll a
repository, or dispatch any operation. Run `surgical doctor` before `start`.
