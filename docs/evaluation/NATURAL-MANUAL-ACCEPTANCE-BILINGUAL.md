# NATURAL Manual Acceptance — Bilingual Record

This record accompanies ADR-027. It reports observed behavior and does not
change the frozen architectural decision or qualify an unobserved result.

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

