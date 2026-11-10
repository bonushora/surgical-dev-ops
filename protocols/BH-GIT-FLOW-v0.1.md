# BH-GIT-FLOW v0.1 — Adendo Operacional de Git

**Status:** operacional experimental  
**Governação superior:** BH-SEP v2.3 + BH-SDP v2.3  
**Escopo:** commit e publicação Git delimitados; este adendo não altera os protocolos superiores.

## 1. Contrato

Uma execução Git somente pode avançar com um envelope imutável e verificável que vincule:

- objetivo, workspace físico e ambiente;
- risco `BAIXO`, `MÉDIO` ou `ALTO`;
- lista explícita de arquivos autorizados;
- validações proporcionais ao risco;
- identidade remota `{ URL, branch, SHA esperado }`;
- HEAD local esperado;
- autoridades independentes `COMMIT_AUTHORIZED`, `PUSH_AUTHORIZED` e
  `DISCLOSURE_AUTHORIZED`.

O fingerprint do envelope protege sua integridade, mas não cria autoridade humana. A autoridade
continua originada na fronteira humana definida pelo Surgical DevOps.

## 2. Risco e validação

| Classe | Operações típicas | Validação mínima |
|---|---|---|
| `BAIXO` | observação local/remota somente leitura | uma validação dirigida |
| `MÉDIO` | commit delimitado; push fast-forward protegido por CAS | duas validações independentes |
| `ALTO` | Production, conteúdo sensível, destruição ou reescrita de histórico | três validações e gates superiores aplicáveis |

Reescrita de histórico e force-push não são permitidos pelo runner v0.1.

## 3. Commit governado

O runner deve:

1. confirmar workspace, HEAD, branch e URL remota;
2. exigir índice inicialmente vazio, preservando staging preexistente por fail-closed;
3. adicionar somente os pathspecs explicitamente autorizados;
4. conferir que o staging efetivo é subconjunto da seleção autorizada;
5. inspecionar o conteúdo staged contra padrões determinísticos de credenciais;
6. executar as validações declaradas sem shell;
7. criar o commit com hooks habilitados;
8. confirmar pai, SHA e arquivos do commit.

A inspeção de segredos é delimitada e não alega detecção universal. Conteúdo que excede o limite
qualificado falha fechado. Falha anterior ao commit restaura somente o staging criado pelo runner e
mantém o working tree.

## 4. Push governado

O push exige simultaneamente `PUSH_AUTHORIZED` e `DISCLOSURE_AUTHORIZED`. Imediatamente antes da
publicação, o runner confere URL, branch e SHA remoto contra o valor esperado. O commit deve ser um
descendente fast-forward do SHA esperado.

A implementação v0.1 publica exatamente um commit cujo pai é o SHA remoto esperado. Antes do push,
o runner reinspeciona de forma independente o diff e os blobs desse commit; assim, a publicação não
confia na procedência alegada pelo gate de commit.

A publicação usa push normal, sem `--force`, `--force-with-lease` ou `--no-verify`. Uma concorrência
após o CAS é rejeitada pela proteção fast-forward do Git. Depois da tentativa, o runner faz readback
independente da ref remota. Somente o SHA exato publicado produz `GREEN`; divergência produz
`BLOCKED`.

Se o processo de push reportar falha, mas o readback remoto confirmar fisicamente o SHA exato, a
operação pode ser `GREEN` com `WARNING` explícito sobre a incerteza do transporte.

## 5. Evidência, recuperação e estados

Evidência somente pode ser reutilizada quando workspace, ambiente, HEAD, URL, branch, SHA remoto,
arquivos autorizados e fingerprint de validação permanecem idênticos.

Os estados normativos do adendo são:

- `GREEN`: pós-condição física confirmada;
- `BLOCKED`: autoridade, identidade, CAS, escopo ou validação insuficiente/divergente;
- `WARNING`: limitação observada que não invalida uma pós-condição física confirmada;
- `DEFERRED`: melhoria explicitamente adiada sem criar GREEN artificial.

Cada resultado materializa relatório compacto com fingerprint. Checkpoints relevantes materializam
snapshot BH-SDP v2.3, distinguindo código, operação e publicação.

## 6. Implementação de referência

- contrato puro: `accelerator/core/git-flow-contract.js`;
- adaptador físico: `accelerator/adapters/governed-git-flow-runner.js`;
- qualificação hermética: `tests/accelerator/governed-git-flow-runner.test.js`.
