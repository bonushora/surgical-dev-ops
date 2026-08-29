# ADR-032 — Fechamento do Desenvolvimento Interativo NATURAL

**Status:** ACEITA / IMPLEMENTADA
**Escopo:** Surgical DevOps / NATURAL e ENGINEER / G1–G10

## Decisão

Um pedido delimitado de mutação JavaScript pode ingressar no pipeline de
desenvolvimento governado pelo terminal interativo. O pipeline deve preservar
esta ordem exata:

1. G1 vincula objetivo, workspace físico, HEAD do repositório e um alvo;
2. G2 obtém somente evidências governadas de leitura/validação;
3. G3 materializa uma proposta imutável de substituição integral;
4. o terminal exibe fingerprints de BEFORE, AFTER e da proposta;
5. somente `aprovar patch <fingerprint exato>` (ou seu equivalente em inglês)
   pode se tornar uma decisão G4;
6. a autoridade Ed25519 local existente assina e verifica essa decisão exata;
7. G5 despacha pelo Orchestrator R3 existente;
8. G9 reivindica antes do despacho físico e G10 consome após o CAS qualificado;
9. G6 valida a projeção gerenciada autoritativa.

Resposta não relacionada, aprovação abrangente, fingerprint diferente,
autoridade local ausente, worktree sujo, HEAD obsoleto, evidência falha,
validação falha ou raiz de runtime ausente falha de forma fechada. Cancelamento
não cria autoridade. `exit` continua disponível com proposta pendente.

O provider cognitivo continua sem autoridade de filesystem, shell, Git,
aprovação, credencial, mutação ou despacho. Este fechamento não adiciona
execução genérica e inicialmente admite somente um alvo `.js` com o seletor já
qualificado `VALIDATE_JS`.

## Consequências

- Nesse caminho delimitado, o terminal não precisa mais solicitar que o usuário
  copie um comando de substituição portador de autoridade.
- A autoridade humana fica vinculada ao conteúdo, tem curta duração, é
  assinada, de uso único e protegida duravelmente contra replay.
- Outros tipos de arquivo permanecem fora deste milestone até a qualificação
  de um seletor de validação dedicado.
