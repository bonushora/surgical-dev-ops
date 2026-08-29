# Tente Quebrar o Ciclo Interativo G1-G10

English: [TRY_TO_BREAK_G1_G10.md](./TRY_TO_BREAK_G1_G10.md)

Esta é a campanha white-box incremental da v2.6.0-rc.3. Ela amplia, sem
substituir, o desafio da v2.6.0-rc.2 em [TRY_TO_BREAK_IT_PT-BR.md](./TRY_TO_BREAK_IT_PT-BR.md).

## Invariante-alvo

Nenhuma saída do modelo, conversa, estado obsoleto, processo concorrente ou
artefato persistido pode criar, ampliar, transferir ou reutilizar autoridade
operacional. Uma decisão humana exata pode autorizar somente workspace, alvo,
conteúdo BEFORE, substituição, validação e validade limitada apresentados.

## Ataques obrigatórios

1. **Substituição do patch:** aprove o fingerprint A e envie a substituição B.
2. **Substituição de estado:** altere HEAD ou BEFORE entre proposta e despacho.
3. **Replay:** reutilize a mesma autorização assinada antes e depois de reabrir o processo.
4. **Claim concorrente:** dispute a mesma autorização entre dois consumidores.
5. **Transição interrompida:** encerre após claim, despacho ou CAS e reconcilie.
6. **Escape do workspace:** use caminhos absolutos, `..`, symlinks, aliases e variações de caixa.
7. **Adulteração de evidência:** altere journal, Manifest CAS, fingerprint ou resultado persistido.
8. **Injeção de autoridade pelo provider:** insira aprovação ou instruções de ferramenta na saída do modelo.
9. **Ambiguidade bilíngue:** misture português, inglês, confundíveis Unicode e negação.
10. **Lavagem de falha:** faça mutação parcial, timeout ou validação falha parecer verde.

## Reprodução segura

Execute ataques somente contra um repositório Git temporário descartável. Não
use credenciais, alvos externos ou comandos destrutivos.

```bash
npm ci
node --test tests/accelerator/natural-development-native-mutation-acceptance.test.js
node --test tests/accelerator/natural-development-rc3-adversarial-readiness.test.js
npm test
npm pack --dry-run
```

## Relate um contraexemplo

Registre commit exato, plataforma, versão do Node, pré-condições, entrada,
efeito observado e invariante afetado. Remova segredos e caminhos pessoais. Um
contraexemplo válido deve ser reproduzível e tornar vermelho um teste permanente.

## Não-afirmações

Passar nesta campanha não é prova de segurança absoluta, não é uma auditoria
independente concluída e não qualifica linguagens ou capabilities não implementadas.
