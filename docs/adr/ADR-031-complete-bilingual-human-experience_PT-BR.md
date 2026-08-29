# ADR-031 — Experiência Humana Bilíngue Completa

**Status:** ACEITA / CONGELADA

## Decisão

Toda superfície do Surgical DevOps destinada a pessoas DEVE oferecer experiências
semanticamente equivalentes em português (PT-BR) e inglês (EN). Isso inclui
onboarding, ativação, ajuda, estado da sessão, propostas governadas, fronteiras de
autorização, cancelamento, progresso, orientação de providers, apresentação de
evidências, falha segura, orientação de recuperação, documentação de instalação e
documentação de release.

Um único pacote, executável, piso de runtime Node.js, Orchestrator determinístico e
modelo de autoridade atendem aos dois idiomas. A seleção de idioma altera somente
a apresentação. Ela NÃO PODE alterar capabilities, risco, política, identidade,
escopo, CAS, journal, anti-replay, dispatch, recuperação ou comportamento
fail-closed.

O onboarding inicial persiste o idioma e o perfil de interação selecionados.
Execuções posteriores reutilizam os dois valores. Uma seleção explícita
`--language en|pt-BR` pode substituir a apresentação em uma execução sem
reescrever a preferência armazenada.

Contratos de máquina permanecem canônicos em inglês: identificadores de schema,
campos JSON, nomes de estado, fingerprints, selectors, nomes de capability, tokens
de protocolo e símbolos de API pública não são traduzidos. As explicações humanas
ao redor desses tokens são bilíngues.

## Qualificação

Testes permanentes DEVEM exercitar fluxos equivalentes PT-BR e EN para NATURAL,
ENGINEER e EXPERT, incluindo relançamento persistido, ajuda, propostas, negação,
cancelamento, evidência governada e encerramento de sessão. Os testes históricos e
a matriz nativa Linux, macOS e Windows continuam obrigatórios.

Nenhuma alegação de tradução completa é válida sem suíte histórica integral, dry
run do pacote e matriz nativa verdes para o commit exato da release.

English: [ADR-031-complete-bilingual-human-experience.md](./ADR-031-complete-bilingual-human-experience.md)
