# AI provider and engineering-agent selection

Português: [AI_PROVIDER_SELECTION_PT-BR.md](./AI_PROVIDER_SELECTION_PT-BR.md)

Surgical DevOps is provider-neutral at its authority boundary. The human owns
approval, the deterministic Orchestrator owns operational governance, and every
AI provider or engineering agent remains replaceable and authority-free.

## Public recommendation

**OpenAI Codex is the recommended advanced engineering-agent option for the
closest experience to a complete conversational development loop.** It is the
first approved reference engineering-agent integration under ADR-013 because
its intended role includes repository analysis, diagnosis, implementation
planning, exact patch proposals, test planning and iterative work toward a
green result.

This is a product and architecture recommendation, not a claim that Codex is
universally superior to every model or agent. Comparative superiority must be
established by reproducible qualification against the same tasks, budgets,
platforms and governed boundaries.

## Available and candidate paths

| Option | Recommended use | Current project status |
| --- | --- | --- |
| OpenAI Codex | Advanced repository engineering and the closest target experience to the full governed development loop | First approved reference engineering agent; complete G1–G8 integration remains under qualification |
| OpenAI Responses provider | Remote frontier cognition, explanation and planning | Qualified bounded cognitive provider; provider tools and storage are disabled |
| Qwen 3 8B through Ollama | Default local, private and bilingual cognition | Qualified local quality profile |
| Gemma 3 4B through Ollama | Faster local bilingual cognition on constrained hardware | Qualified local fast profile |
| Claude Code, Gemini-based agents and other engineering agents | Future alternative engineering-agent integrations | Architecturally permitted but not currently qualified by the canonical integration suite |
| Other OpenAI-compatible providers | Future replaceable remote cognition | Requires an explicit adapter, commercial/privacy disclosure and qualification |

Automatic discovery and default activation are permitted only for a qualified
local Ollama model: the endpoint must be the canonical loopback endpoint, the
local transport must be qualified, and the allowed model must already be
installed in the verified inventory. No model is downloaded automatically.
External providers, including Codex, are explicit opt-in only and are never an
automatic fallback. An explicit human selection is never silently replaced.
No provider selection grants operational authority or authorizes filesystem,
shell, Git, mutation, external network, or any other operation.

## Authority remains identical for every option

Selecting Codex does not grant it shell, filesystem, Git, mutation or approval
authority. The same rule applies to OpenAI, Ollama, Qwen, Gemma, Claude,
Gemini and every future provider:

1. the agent interprets, reasons and proposes;
2. Surgical DevOps collects governed evidence;
3. the human authorizes the exact sensitive operation;
4. the Orchestrator validates policy, scope, identity and lifecycle;
5. qualified adapters perform only the bounded operation;
6. journal, Manifest CAS, validation and recovery evidence determine success.

Provider failure, substitution or unavailability cannot weaken this boundary.
Local Ollama profiles remain the recommended path when offline operation,
privacy or absence of per-request API cost is the priority.

`@openai/codex-sdk` is an optional npm dependency. A basic offline installation
uses `--omit=optional`; `NATURAL`, `ENGINEER` and `EXPERT` remain installed and
usable without the SDK. Codex remains explicit opt-in and uses an external
cognitive service subject to the configured account/plan. If the SDK is absent,
Codex is reported as unavailable or configuration-required and fails closed: it
is not activated, no provider is silently substituted and nothing is downloaded
automatically. A complete installation may resolve the SDK only through an npm
mechanism explicitly authorized by the human. This is not a claim that Codex is
installed or qualified.

The Codex SDK integration enforces that boundary physically. The SDK receives
only a virtual `/cognitive/workspace` path and starts a generated launcher in a
restricted ephemeral session. On qualified Linux hosts, Bubblewrap exposes the
Codex executable, indispensable runtime libraries and that empty cognitive
session only; the original repository, `.git`, user directories, host secrets,
external writes and network are outside the namespace. Repository content can
reach the cognitive request only after broker acquisition and sensitive-content
qualification. The launcher preserves the SDK JSONL stream and exit semantics,
and its session is removed on reset, close and failure.

Codex uses a local SDK subprocess, but its cognition is an external service.
The current containment denies the external-service network path, so real Codex
remains `BLOCKED` even when explicitly selected. That service connectivity is
distinct in purpose from agent-tool network authority; this repository does not
claim a qualified physical separation between them.

There is no read-only fallback. When native containment is absent or has not
been physically qualified, Codex remains unavailable with
`CODEX_CONTAINMENT_UNAVAILABLE`. Linux Bubblewrap is physically qualified in
the current integration tests. macOS Seatbelt and Windows AppContainer retain
native adapter boundaries but their Codex streaming launchers are
`NOT_EXECUTED` and unavailable until physical qualification on those platforms.

## Honest current limitation

Codex is the recommended advanced target, but the repository does not yet claim
that its complete end-to-end NATURAL execution experience is qualified. G1–G6
of the governed development loop are implemented. Durable anti-replay and
recovery (G7), the complete bilingual NATURAL experience (G8), and final
adversarial/native qualification must become green before that claim is made.
The real network-backed Codex executable is intentionally not exercised by the
offline containment suite; it uses a local protocol-compatible executable to
verify process isolation and streaming without credentials or network access.
