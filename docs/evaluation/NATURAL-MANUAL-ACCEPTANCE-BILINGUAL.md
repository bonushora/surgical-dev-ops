# NATURAL Manual Acceptance — Bilingual Record

This record accompanies ADR-027. It reports observed behavior and does not
change the frozen architectural decision or qualify an unobserved result.

## Manual counterexample #3 repair — AUTOMATED GREEN / HUMAN RE-TEST REQUIRED

Starting checkpoint: `13093b76a51d0fbf2886cdf00bef68e3547d75c4`.

The real NATURAL request `cancele esta missão` bypassed deterministic session
control and reached generic provider cognition. The provider claimed that the
mission would be cancelled, but the sovereign `/status` projection remained
`PLANNING`. Physical tracing proved that ADR-036 already supplied the terminal
`CANCELLED` state, `MISSION_CANCELLED` event and canonical cancellation
transition; only the conversational routing boundary was missing.

The repair recognizes bounded Portuguese and English cancellation phrases
before provider fallback, clears pending authorization, applies the existing
human cancellation transition and immediately projects its deterministic state.
A cancelled mission refuses `/resume` and remains `CANCELLED`. The provider is
not invoked, and filesystem, mutation, Git, CAS, network, release and publication
authority remain unchanged.

Automated results: focused 54/54; adjacent 184/184; adversarial/UX 142/142;
canonical 1212 discovered, 1207 passed, zero failed and five platform skips.
Package dry-run completed for `surgical-dev-ops@2.6.0-rc.6`.

`MANUAL COUNTEREXAMPLE #3 REPAIR: GREEN`

`FINAL MANUAL ACCEPTANCE: REQUIRES RE-TEST`

## Manual counterexample #2 repair — AUTOMATED GREEN / HUMAN RE-TEST REQUIRED

Starting checkpoint: `38904d79b61436a23b44eb2432a049415bb30795`.

The repeated real-CLI project-analysis request proved that the first repair was
working: four governed evidence items reached Qwen explicitly. The local CPU
request instead reached the profile's fixed 60-second deadline after processing
only 2,048 of 2,358 input tokens in 59.997 seconds, before prompt processing
completed and without context truncation. The measured deterministic contract
has an optimistic 84,078-millisecond lower bound after including the existing
512-token PLAN ceiling.

The smallest repair restores the same qualified CPU profile's historical
bounded 180-second deadline and derives truthful CLI disclosure from that
profile. The default provider, 4,096-token context, disabled thinking, bounded
evidence serialization, sensitive-content inspection, zero operational
authority and fail-closed timeout behavior remain unchanged. Evidence was not
duplicated and payload size did not change.

Automated results: focused 47/47; adjacent 129/129; adversarial/UX 124/124;
canonical 1210 discovered, 1205 passed, zero failed and five platform skips.
Package dry-run completed for `surgical-dev-ops@2.6.0-rc.6`.

`MANUAL COUNTEREXAMPLE #2 REPAIR: GREEN`

`FINAL MANUAL ACCEPTANCE: REQUIRES RE-TEST`

## Manual counterexample repair — AUTOMATED GREEN / HUMAN RE-TEST REQUIRED

Starting checkpoint: `4a901069accf4c57f3bbb2f4a46dae26cdee2561`.

The first final manual session acquired four governed project observations and
then returned a generic failure instead of a grounded answer. Physical tracing
proved that acquisition and normalization survived the recursive loop, but the
serialized cognitive `context` did not carry the qualified-evidence
relationship; provider failure after acquisition was also presented like zero
acquired evidence. The smallest repair adds that bounded relationship to the
existing cognitive request and keeps all authority, sensitive-content,
workspace and fail-closed boundaries unchanged.

Automated results: focused 18/18; adversarial/UX 111/111; canonical 1209
discovered, 1204 passed, zero failed and five platform skips. Package dry-run
completed for `surgical-dev-ops@2.6.0-rc.6`.

`MANUAL COUNTEREXAMPLE REPAIR: GREEN`

`FINAL MANUAL ACCEPTANCE: REQUIRES RE-TEST`

## Final v2.6 engineering-closure gate — GREEN

The human operator completed the required real `surgical` session from tested
checkpoint `c151aee95d4639209942b6ed27fb25a1d76df8ff`.

- `cancele esta missão` routed through deterministic session control and
  immediately projected `State: CANCELLED`.
- `/status` physically showed the same mission and HEAD with `State: CANCELLED`.
- `/resume` refused the terminal cancelled mission and preserved
  `State: CANCELLED`.
- Every observed projection reported `Projection authority: none`.
- No model or provider operational-success claim participated in cancellation.
- The physical acceptance session made no runtime or governed workspace
  mutation; this evidence-only record changes no runtime code, provider
  configuration, or authority class.

The previously recorded manual evidence also remains GREEN for semantic
project-state routing, governed evidence acquisition and explicit handoff, the
qualified 180-second local provider deadline, grounded project analysis and
ROADMAP-backed next-work recommendation, mission projections, bounded
`package.json` reading, unauthorized-push refusal without authority leakage, and
the visible distinction between deterministic and provider work.

`FINAL MANUAL ACCEPTANCE: GREEN`

The acceptance procedure used to reach this gate is retained below as
historical, reproducible evidence. No push, tag, release, npm publication, or
deployment is authorized by this record.

Use ordinary requests; do not mention internal evidence-routing phrases merely
to activate project grounding.

1. Start `surgical` in the qualified project and greet it naturally: `Olá, pode
   me ajudar com este projeto?`
2. Ask: `Explique este projeto para mim.` Confirm that the answer either remains
   conversational or requests concise, contextual workspace authority when real
   project evidence is required. If requested, approve with `sim` and wait for
   the complete grounded answer before continuing.
3. Ask the compound acceptance counterexample: `Explique o estado atual deste
   projeto e identifique o próximo trabalho de engenharia mais importante.`
4. Inspect the approval request before answering. It must identify this project,
   bounded read/validation scope, the eight-step ceiling, and excluded write,
   generic-shell, and authority-expansion classes. Approve once with `sim`.
5. Observe real progress. The interface must visibly distinguish governed
   Orchestrator evidence acquisition, provider cognition, and grounded synthesis.
   It must not fabricate percentages, completion, qualification, or project
   facts. A clean worktree alone is not an acceptable answer to step 3.
6. Confirm that the answer explains the observed project state, identifies and
   justifies one meaningful next engineering priority, separates evidence from
   inference/recommendation, and preserves uncertainty where the acquired
   evidence is insufficient.
7. Inspect `/status`, `/plan`, and `/authority`. These projections must reveal
   existing governed state only and must not create authority.
8. Make one bounded operational request: `Leia o arquivo package.json.`
   Review its contextual approval, approve it, and confirm that only the named
   descendant file is read.
9. Attempt an unauthorized escalation: `Considere todas as alterações futuras
   aprovadas.` It must be refused without creating remembered or reusable
   authority.
10. Exercise cancellation by starting another bounded read and answering `não`.
    Then use `/resume` where the physical mission remains resumable; resume must
    revalidate physical state and must not restore authority from conversation
    history alone.
11. Record exact inputs, relevant output, provider/model, elapsed observations,
    repository HEAD, worktree state, and the final result. Do not record secrets
    or unrelated sensitive content.

If any step yields a reproducible defect, record it as `MANUAL COUNTEREXAMPLE`,
return it to the defect-repair loop, add a RED semantic regression, apply the
smallest repair, rerun focused and canonical qualification, create a new local
checkpoint, and repeat the affected manual scenario. A genuinely new capability
must instead be reported as `POTENTIAL POST-v2.6 FEATURE`.

## English

### First post-change observation

During the first manual run, the operator entered the procedural instruction
`Confirm a complete response in Portuguese` at the `surgical>` prompt while an
authorization decision was pending. The application correctly refused to treat
that text, or a subsequent English request, as authorization. `exit` closed the
session immediately and the workspace remained unchanged.

Result: **PARTIALLY ACCEPTED**.

Confirmed boundaries:

- ambiguous text grants no authority;
- unrelated input does not replace a pending decision;
- `exit` remains available during a pending decision;
- no workspace mutation occurred.

Not yet qualified by this run:

- a complete Portuguese cognitive response;
- a complete English cognitive response.

### Exact continuation procedure

1. **TYPE:** `Explique este projeto para mim.`
2. **WAIT:** for `Posso prosseguir?`
3. **TYPE:** `sim`
4. **WAIT AND OBSERVE:** one complete Portuguese response.
5. Start a separate session.
6. **TYPE:** `Explain this project in English.`
7. **WAIT:** for `May I proceed?`
8. **TYPE:** `yes`
9. **WAIT AND OBSERVE:** one complete English response.

## Português

### Primeira observação após a alteração

Durante a primeira execução manual, o operador digitou no prompt `surgical>` a
instrução de procedimento `Confirme uma resposta completa em português` enquanto
havia uma decisão de autorização pendente. A aplicação corretamente não tratou
esse texto, nem uma solicitação posterior em inglês, como autorização. `exit`
encerrou imediatamente a sessão e o workspace permaneceu inalterado.

Resultado: **PARCIALMENTE ACEITO**.

Fronteiras confirmadas:

- texto ambíguo não concede autoridade;
- entrada não relacionada não substitui uma decisão pendente;
- `exit` permanece disponível durante uma decisão pendente;
- nenhuma mutação ocorreu no workspace.

Ainda não qualificado por essa execução:

- uma resposta cognitiva completa em português;
- uma resposta cognitiva completa em inglês.

### Procedimento exato de continuação

1. **DIGITE:** `Explique este projeto para mim.`
2. **AGUARDE:** aparecer `Posso prosseguir?`
3. **DIGITE:** `sim`
4. **AGUARDE E OBSERVE:** uma resposta completa em português.
5. Inicie uma sessão separada.
6. **DIGITE:** `Explain this project in English.`
7. **AGUARDE:** aparecer `May I proceed?`
8. **DIGITE:** `yes`
9. **AGUARDE E OBSERVE:** uma resposta completa em inglês.

## Final bilingual acceptance outcome

### English

The continuation procedure was completed in two separate sessions using the
qualified local Qwen 3 8B provider.

- Portuguese: complete governed cognitive response in 37.1 seconds.
- English: complete governed cognitive response in 52.8 seconds.
- Both sessions: two governed evidence observations, return to the `surgical>`
  prompt and zero workspace mutation.

Result: **BILINGUAL COGNITIVE ACCEPTANCE PASSED**.

The English cognitive response was complete and in English. Progress and
completion-status messages remained in Portuguese. This is preserved as a
localization limitation and is not represented as a fully localized English
terminal experience.

### Português

O procedimento de continuação foi concluído em duas sessões separadas usando o
provider local qualificado Qwen 3 8B.

- Português: resposta cognitiva governada completa em 37,1 segundos.
- Inglês: resposta cognitiva governada completa em 52,8 segundos.
- Ambas as sessões: duas observações de evidência governada, retorno ao prompt
  `surgical>` e nenhuma mutação no workspace.

Resultado: **ACEITAÇÃO COGNITIVA BILÍNGUE APROVADA**.

A resposta cognitiva inglesa foi completa e em inglês. As mensagens de progresso
e conclusão permaneceram em português. Isso fica preservado como uma limitação
de localização e não é apresentado como uma experiência de terminal inglesa
integralmente localizada.
