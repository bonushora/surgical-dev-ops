# Qualified npm publication

Português: [NPM_PUBLICATION_PT-BR.md](./NPM_PUBLICATION_PT-BR.md)

Surgical DevOps publishes one package for `NATURAL`, `ENGINEER` and `EXPERT`.
Publication is intentionally unavailable from ordinary branch and pull-request
runs. An immutable `v*` tag starts the canonical Ubuntu, macOS and Windows
matrix. The `publish-npm` job depends on the complete matrix and cannot start if
any native job fails.

The tag must exactly equal `v` plus the package version and must identify the
checked-out commit. The npm environment must use npm Trusted Publishing for
this GitHub repository and workflow. The job requests only read-only repository
contents and the OIDC identity token required by npm provenance.

Reusing an existing npm version, bypassing the matrix, publishing from a local
worktree or supplying publication authority to an AI provider is outside the
qualified contract.
