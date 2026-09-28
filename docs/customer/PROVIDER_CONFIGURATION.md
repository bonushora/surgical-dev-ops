# Provider configuration

Use `surgical configure provider`. Qualified choices are local Ollama and the
currently supported explicit remote provider mechanisms. Remote configuration
requires an HTTPS endpoint, explicit network permission, and a reference such as
`env:OPENAI_API_KEY`; plaintext credentials are rejected.

There is no silent provider fallback. Provider selection changes cognition only.
It grants no filesystem, mutation, Git, network-mutation, release, recovery, or
deployment authority.
