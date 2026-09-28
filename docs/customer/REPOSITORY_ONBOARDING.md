# Repository onboarding

`surgical open /absolute/repository` requires a canonical physical Git root. It
records repository identity, branch, exact HEAD, and worktree status. Symlinks,
junction substitutions, nested non-root paths, and unsupported Git state fail
closed.

Enrollment and a clean worktree are evidence, not authority. Production
eligibility and exact current human authority remain separate decisions.
