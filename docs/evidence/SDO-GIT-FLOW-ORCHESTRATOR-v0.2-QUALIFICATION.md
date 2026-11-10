# SDO-GIT-FLOW-ORCHESTRATOR v0.2 — Evidência de Qualificação

**Data observada:** 2026-11-10  
**Governança:** BH-SEP v2.3 + BH-SDP v2.3  
**Baseline:** BH-GIT-FLOW v0.1  
**Branch:** `fix/agmi-store-integrity-portability`  
**SHA inicial/local/remoto:** `5729538e8bc715172116a3e081e491c83c90d14d`

## Preservation Lock

O checkpoint externo `/tmp/sdo-git-flow-orchestrator-v02-checkpoint.XjCUCl`
foi criado antes da implementação:

- bundle Git com 77 refs e histórico completo, SHA-256
  `32f5e460ac7a62b4a04fd026ad48cc68020377c3dc2b4195601701acd0ed9a08`;
- arquivo dos seis documentos preexistentes, SHA-256
  `88a09af80007b54715e03af8e0b071d2d8b1cde8337f9dd86a103db8df99223d`;
- índice Git, SHA-256
  `10094cb2d35239d24de97ec13f27f84a0e809fec5b82f3cb4c1bfa2873690de5`.

O readback em `/tmp/sdo-git-flow-orchestrator-v02-restore.FP7vjU` confirmou
checkout do SHA inicial, `git fsck --full --strict`, índice byte a byte idêntico e
os seis SHA-256 originais dos documentos não rastreados.

## Integração cirúrgica

- `mission-git-flow-closure` aceita somente missão imutável `GREEN`, evidência
  canônica PASS, plano concluído e allowlist exatamente igual a `mission.changes`;
- a autorização Git precisa corresponder ao objetivo, workspace e HEAD inicial da
  missão;
- `mission GREEN` permanece explicitamente incapaz de criar autoridade Git;
- `COMMIT_AUTHORIZED`, `PUSH_AUTHORIZED` e `DISCLOSURE_AUTHORIZED` continuam
  independentes e são consumidos pelo runner BH-GIT-FLOW v0.1;
- `ELIGIBLE`, `LOCAL_GREEN`, `REMOTE_GREEN` e `BLOCKED` distinguem fechamento
  local de publicação remota;
- a reconciliação read-only adota commit ou push já ocorridos após interrupção sem
  repetir mutações;
- snapshot BH-SDP v2.3 é produzido em cada gate físico;
- `natural-agentic-mission` e o repair loop R5 não foram alterados nem ganharam
  autoridade Git.

## Red-to-Green

Onze cenários de integração herméticos ficaram GREEN:

1. missão autorizada com GREEN local e remoto separados;
2. missão GREEN sem `COMMIT_AUTHORIZED`;
3. commit local sem `PUSH_AUTHORIZED`;
4. commit local sem `DISCLOSURE_AUTHORIZED`;
5. allowlist divergente de `mission.changes`;
6. falha de validação antes do commit;
7. avanço remoto concorrente e CAS divergente;
8. retomada após commit interrompido sem duplicação;
9. retomada após push interrompido por readback;
10. rejeição remota, estado `BLOCKED` e recuperação posterior;
11. missão não GREEN inelegível apesar de envelope Git autorizado.

## Regressão

- baseline dirigida: `29/29 PASS`;
- runner + integração: `25/25 PASS`;
- regressão pertinente incluindo R5, R6 e RUNNER: `66/66 PASS`;
- suíte canônica: `1744` testes, `1731 PASS`, `0 FAIL`, `13 SKIP`, duração
  `84691.712 ms`.

Os skips são qualificações nativas condicionadas a macOS/Windows e permanecem
honestamente não executados nesta plataforma.

## Publicação

O contrato da missão v0.2 autoriza commit local, mas não contém autorização explícita
de publicação vinculada a este novo commit. Portanto, o envelope final usa
`PUSH_AUTHORIZED=false` e `DISCLOSURE_AUTHORIZED=false`. O SHA local final e o
snapshot pós-commit são evidência de runtime; publicação v0.2 permanece dimensão
independente e não executada.
