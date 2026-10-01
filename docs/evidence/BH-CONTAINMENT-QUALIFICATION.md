# BH-CONTAINMENT local qualification / Qualificação local BH-CONTAINMENT

Date / Data: 2026-09-30

Repository: `https://github.com/bonushora/surgical-dev-ops`

Branch: `feature/customer-operable-runtime-v1`

Local HEAD: `a7cdad1c1e42e9a58f3d93cf7385c6bf229b5024`

Observed remote `main`: `24f0f1946eb795b3464b2846953e191755b9c8c3`

## Resultado / Outcome

O perfil `BH-SEP-v2.3+BH-SDP-v2.3+BH-CONTAINMENT-v1` foi integrado ao
launcher Codex real. O loader do hospedeiro valida caminho, versão e SHA-256 de
todas as partes antes de criar a sessão. WebSocket é recusado com `426` antes do
upgrade. HTTP permitido mantém validação de método, rota, query, JSON,
ferramentas, tamanho e headers. A API key privilegiada permanece no broker do
hospedeiro; o sandbox recebe somente uma identidade aleatória não privilegiada.
O login por `auth.json` fica bloqueado sem fallback até existir mediação
equivalente. A saída de conteúdo exige origem governada autorizada além da
inspeção heurística.

The `BH-SEP-v2.3+BH-SDP-v2.3+BH-CONTAINMENT-v1` profile is integrated into the
real Codex launcher. The host loader validates every component path, version,
and SHA-256 before creating a session. WebSocket is rejected with `426` before
upgrade. Allowed HTTP retains method, route, query, JSON, tool, size, and header
validation. The privileged API key remains in the host broker; the sandbox
receives only a random non-privileged identity. `auth.json` login is blocked
without fallback until equivalent mediation exists. Content egress requires an
authorized governed source in addition to bounded heuristic inspection.

## Evidência / Evidence

- Baseline anchor tests before runtime mutation: `33 passed, 0 failed`.
- Baseline WebSocket reproduction against exact `HEAD` bytes in a temporary
  tree: HTTP forbidden operation returned `400` with `0` upstream calls;
  WebSocket initiated `1` fictitious upstream call before inspecting equivalent
  application bytes. No real provider was contacted.
- Final full suite: `1592 tests`, `1583 passed`, `0 failed`, `9 skipped`,
  duration `68571.427706 ms`.
- The nine skips are not native PASS evidence: they cover macOS/Windows-only
  probes and one unavailable lexical/physical alias condition.
- `git diff --check`: PASS.
- `npm pack --dry-run --json` with a transient `/tmp` cache: PASS, `219` package
  entries. The package contains the loader and all four containment protocol
  entry/extension files. No publish occurred.
- Real provider, paid inference, real credentials, deploy, release, push, PR,
  merge, and commit: `NÃO_EXECUTADO`.

## Matriz requisito → consumidor → teste → observação → limitação

| Requisito | Consumidor real | Teste/evidência | Observação | Limitação |
| --- | --- | --- | --- | --- |
| Perfil íntegro antes de ação protegida | `createCodexCognitiveContainment` | `containment-profile-loader.test.js`, documentação-integrity | Ausência, byte alterado e identidade incompatível bloqueiam antes da factory nativa | A âncora é o runtime confiável do hospedeiro; não é uma alegação contra comprometimento do próprio host |
| Paridade de transporte | broker Unix/relay Linux | teste adversarial HTTP/WS com upstream fictício | HTTP proibido fica em zero chamadas; WS retorna `426` antes do upstream | Operação que dependa de WebSocket fica `BLOCKED`; nenhum parser artesanal foi criado |
| Credencial fora do agente | SDK adapter → containment → broker | testes de injeção, falsificação e probe Bubblewrap | upstream recebe a fixture host-side; env/argv/mount/log do agente não contêm a credencial privilegiada | `auth.json` login fica `BLOCKED`; conta real não foi homologada |
| Destino e operação fixos | broker provider-only | testes de host, rota, query, método, `CONNECT`, header e corpo | somente HTTP delimitado chega ao upstream configurado | redirects não são seguidos e `Location` não é encaminhado; funcionalidade real continua `NÃO_EXECUTADO` |
| Classificação honesta e saída autorizada | gateway, sessão cognitiva, recursive loop, customer development e workspace experience | testes de `segredo_operacional=VALOR_FICTICIO`, origem desconhecida e regressões dos consumidores | padrão conhecido é redigido; ausência de match não é certificação universal; origem desconhecida bloqueia | regex não classifica semanticamente todo segredo |
| Isolamento Linux | launcher Bubblewrap e relay | probes físicos de workspace, escrita, rede, subprocesso, env e cleanup | PASS nativo neste host Linux, sem modo privilegiado | macOS/Windows Codex streaming: `NÃO_EXECUTADO`; testes de recusa não contam como isolamento nativo |
| Distribuição e documentação | pacote npm e entry points PT/EN | documentation-integrity + `npm pack --dry-run` | loader e protocolos novos estão no pacote | relatório de evidência fica fora do pacote por desenho; nenhuma publicação foi feita |

## Integridade preservada / Preserved integrity

Os RAW, traduções antigas e cópias combinadas não foram modificados. Hashes
reverificados:

- v2.2 RAW: `f4e8639163b0321fff86133a69ec59c2822ccdebcd24d2ccb459b5bc1c3b35cb`,
  `04ea782ada1abf7fb959329054c57f87a0e86fca99a31d2e37751d3bdf7d47bc`.
- v2.3 RAW: `0360b145b4f1ba8cb211ffdb16cf5d70d47c7dc55a11395bd2afb9d5241eb4ee`,
  `413b3613c75ce89defae4d49ad0b21d92f56519c14f5b32c8e8e152997887f47`.
- v2.3 translations/combined: `64bc602ea0556eb1819daf5ebd6aa07ff36c00f8a3443205f9035a93b02fdc13`,
  `49f5ba8a8be6d075f41b299b69ebffa1cf6a3018f1d93bf373c4c2d0ec9ae222`,
  `d877a7bd876ee37df2378476150827e20a7e2437b8e8ee313f06b7992396f1bb`,
  `fdfa13cc39eb36a7f07129398d8600887babf6535d0292bc561e960d0792055e`.

## Estado preexistente e escopo / Pre-existing state and scope

O working tree já estava sujo; seu diff agregado pré-tarefa tinha SHA-256
`4d357529fe42a2122f5956bb391730829a0c71d1b007ff24bf2ebea4d9bae33b`.
Essas mudanças foram preservadas. A única interseção necessária foi
`accelerator/cli/surgical.js`, cujo arquivo pré-tarefa tinha SHA-256
`49b4e092c40146295195166410b290004ca3aa6eb1b974de277d819b8e9e7a26`;
o patch acrescentou somente a exigência `egressAuthorized === true` no consumo
de evidência já qualificada. O mapa completo dos hashes preexistentes está no
registro complementar.

O diretório `documental/` descrito no contrato não existia neste checkout;
conferência/aplicação de seus cinco documentos, patch, manifesto e instruções
permanece `NÃO_EXECUTADO`, sem inferir bytes ou hashes.

## Riscos residuais / Residual risks

- Segurança de recusa de WebSocket: `PASSOU`; funcionalidade Codex dependente de
  WebSocket: `BLOCKED`.
- Mediação API-key com fixtures: `PASSOU`; login real e inferência real paga:
  `NÃO_EXECUTADO`.
- Isolamento nativo Linux: `PASSOU` neste host; macOS e Windows:
  `NÃO_EXECUTADO`.
- Este resultado não declara contenção de toda IA presente ou futura.
