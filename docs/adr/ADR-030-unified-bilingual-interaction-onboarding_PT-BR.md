# ADR-030 — Onboarding bilíngue unificado dos modos de interação

English: [ADR-030-unified-bilingual-interaction-onboarding.md](./ADR-030-unified-bilingual-interaction-onboarding.md)

**Status:** IMPLEMENTADO E QUALIFICADO LOCALMENTE

## Decisão

O Surgical DevOps é distribuído como um único pacote npm, um único requisito de
runtime Node.js e um único Orchestrator determinístico. `NATURAL`, `ENGINEER` e
`EXPERT` são perfis delimitados de apresentação sobre a mesma autoridade de
governança canônica; não são produtos, pacotes ou níveis de segurança separados.

Um terminal humano em primeira execução recebe um onboarding bilíngue e escolhe
um perfil. A preferência resultante armazena somente idioma e modo de interação.
Seu schema declara explicitamente autoridade operacional, de mutação e de
aprovação iguais a zero. Ela não pode autorizar, despachar, ampliar escopo nem
reduzir BH-SEP/BH-SDP.

`--interaction` é um override limitado à invocação e nunca reescreve a
preferência salva. `--configure` executa novamente o onboarding delimitado. Uso
não interativo sem preferência preserva `EXPERT` por compatibilidade e nunca cria
configuração como efeito colateral.

## Fronteira de persistência

A preferência fica na área de configuração do usuário do sistema operacional,
fora do workspace governado do projeto. O adapter rejeita diretórios não
canônicos, links simbólicos, arquivos grandes demais, JSON corrompido, modos
desconhecidos e qualquer registro portador de autoridade. A publicação do pacote
npm continua sendo uma operação posterior de release e exige CI verde em Linux,
macOS e Windows.

## Não afirmações

O onboarding não torna determinística a saída do modelo, não autentica uma
pessoa, não concede acesso a filesystem ou processo e não substitui as fronteiras
R3, journal, Manifest CAS, recovery e anti-replay existentes.
