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

No provider is selected automatically. A user must make an explicit choice,
and activation additionally requires the corresponding adapter, credentials,
availability, privacy and cost disclosure, connection verification and green
qualification.

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

## Honest current limitation

Codex is the recommended advanced target, but the repository does not yet claim
that its complete end-to-end NATURAL execution experience is qualified. G1–G6
of the governed development loop are implemented. Durable anti-replay and
recovery (G7), the complete bilingual NATURAL experience (G8), and final
adversarial/native qualification must become green before that claim is made.
