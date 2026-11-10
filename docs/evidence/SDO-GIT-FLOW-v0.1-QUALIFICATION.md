# SDO-GIT-FLOW-ACCELERATOR v0.1 — Evidência de Qualificação

**Data observada:** 2026-11-10  
**Governança:** BH-SEP v2.3 + BH-SDP v2.3 + BH-GIT-FLOW v0.1  
**Branch:** `fix/agmi-store-integrity-portability`  
**SHA inicial:** `f267cf38b0ac321b6361602973b4d34b5c043e1c`  
**Remoto:** `https://github.com/bonushora/surgical-dev-ops.git`  
**SHA remoto inicial observado:** `f267cf38b0ac321b6361602973b4d34b5c043e1c`

## Preservação

Antes da implementação foi criado o checkpoint externo
`/tmp/sdo-git-flow-checkpoint.iqNCmK`:

- `repository.bundle` com 77 refs e histórico completo, SHA-256
  `38a05549e4e40a32f569f1de075afbd650d315d5db928a1b3b811ac2e6eb0010`;
- `preexisting-untracked.tar` com os seis documentos preexistentes, SHA-256
  `88a09af80007b54715e03af8e0b071d2d8b1cde8337f9dd86a103db8df99223d`;
- cópia do índice Git, SHA-256
  `98a9ae270a86e8f790572092645f855ed6374d02ed6f0c35f4b4513c12dbf1d4`.

O readback foi executado em `/tmp/sdo-git-flow-restore.dcoBj8`: clone do bundle,
checkout do SHA inicial, `git fsck --full --strict`, extração dos seis arquivos com
SHA-256 idênticos e comparação byte a byte do índice. Os seis arquivos permanecem
fora do escopo de commit.

## Componentes qualificados

- contrato imutável e fingerprinted de autorização, risco, evidência, relatório e
  snapshot BH-SDP;
- runner físico com seleção explícita de arquivos, hooks ativos, validação sem shell
  e recuperação do staging;
- separação de `COMMIT_AUTHORIZED`, `PUSH_AUTHORIZED` e
  `DISCLOSURE_AUTHORIZED`;
- inspeção determinística delimitada de credenciais no staging e novamente no commit
  publicável;
- identidade física `{ URL, branch, SHA }`, CAS imediatamente anterior ao push,
  fast-forward normal sem force e readback remoto independente;
- estados `GREEN`, `BLOCKED`, `WARNING` e `DEFERRED` e condições exatas de
  reutilização de evidência.

## Red-to-Green adversarial

A qualificação hermética cobre 14 casos:

1. commit autorizado, escopo válido e readback positivo;
2. commit sem autorização;
3. push sem autorização de push ou disclosure;
4. staging preexistente não autorizado;
5. divergência concorrente do SHA remoto;
6. commit manual com arquivo fora do escopo;
7. commit manual contendo padrão de credencial;
8. URL ou branch remota incorreta;
9. segredo no conteúdo staged;
10. falha de validação e recuperação do staging;
11. rejeição durante publicação e readback da falha;
12. recuperação posterior com CAS renovado;
13. reutilização inválida de evidência;
14. preservação de untracked e snapshot BH-SDP.

A primeira execução encontrou duas falhas: uma composição de objeto sobrescrevia o
`ok: false` da checagem de identidade e o clone concorrente do fixture não selecionava
explicitamente `main`. Ambas foram corrigidas dentro do escopo. A repetição ficou
`14/14 PASS`.

## Regressão

- baseline dirigida anterior à implementação: `45/45 PASS`;
- regressão dirigida integrada: `59/59 PASS`;
- suíte canônica `npm test`: `1733` testes, `1720 PASS`, `0 FAIL`, `13 SKIP`,
  duração `84104.896 ms`;
- `git diff --check`: PASS.

Os skips são qualificações nativas condicionadas a macOS/Windows e não foram
promovidos artificialmente a PASS.

## Limites honestos

- a detecção de credenciais usa padrões determinísticos e não afirma classificação
  universal;
- o runner v0.1 publica exatamente um commit sobre o SHA esperado;
- force-push, reescrita de histórico, bypass de hooks e `--no-verify` permanecem
  proibidos;
- o SHA final e o readback remoto são evidência de runtime e devem ser registrados no
  relatório/snapshot pós-publicação, porque um commit não pode conter seu próprio SHA.
