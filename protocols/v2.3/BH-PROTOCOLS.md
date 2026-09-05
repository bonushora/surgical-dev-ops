# BH-SEP v2.3 — Protocolo de Evolução Segura

## Objetivo

Governar evolução assistida por IA com segurança proporcional ao risco, preservando autoridade humana, previsibilidade e evidência física. Esta versão adota **Governança sem Fricção**: controles protegem decisões e mutações relevantes sem transformar toda operação em uma interrupção.

## Invariantes normativos

1. **Autoridade humana:** a IA pode analisar e propor, mas não amplia autorização nem substitui decisão humana exigida pelo contexto.
2. **Fail-closed:** diante de autoridade ausente, evidência insuficiente, divergência ou regra ambígua, não executar a mutação; declarar o bloqueio.
3. **PATCH por padrão:** alterações devem ser mínimas e localizadas. Refatoração exige autorização humana explícita.
4. **Evidência física:** afirmações sobre estado, linhas, testes, Git ou artefatos devem se apoiar em evidência observável. Evidência ausente é `NÃO_EXECUTADO` (ou equivalente normativo), nunca uma inferência apresentada como fato.
5. **Red-to-Green:** antes de uma refatoração ou mudança de alto risco, verificar a baseline pertinente; depois, validar a alteração até o estado GREEN ou declarar o bloqueio.

## Governança proporcional ao risco

Classifique a operação antes de mutar:

- **BAIXO:** documentação, ajustes de baixo impacto, microleituras e operações já cobertas pela autoridade vigente. Inspecione o contexto relevante e use validação proporcional (por exemplo, lint Markdown, parse ou teste documental). Não é necessária nova aprovação para uma operação já autorizada.
- **MÉDIO:** mudança com consumidores, comportamento ou dependências limitados. Explicite objetivo, causa ou hipótese, arquivos e faixas lidas, risco e estimativa de escopo; faça validação direcionada e registre resultado.
- **ALTO:** refatoração, mudança arquitetural, segurança, dados, contratos públicos ou efeito operacional amplo. Exija baseline prévia, plano explícito e autorização humana específica antes da mutação; valide de forma abrangente.

A estimativa de diff é uma previsão de escopo, não um limite físico de três linhas. Se o escopo crescer, reavalie o risco e peça autorização quando a categoria ou a autorização mudar.

O risco pertence à operação delimitada, não ao projeto inteiro. Reclassifique
obrigatoriamente quando o escopo ou o ambiente mudar.

| Nível | Critério e controle proporcional |
| --- | --- |
| **BAIXO** | Operação local, reversível, isolada e sem credenciais ou efeito externo; uma autorização; sem gates intermediários; validação diretamente pertinente. |
| **MÉDIO** | Alteração funcional limitada, consumidores afetados, integração ou publicação reversível; gates somente por nova fronteira; testes dos consumidores, CAS e pós-condição remota. |
| **ALTO** | Production, credenciais sensíveis, dados reais, ação destrutiva, irreversibilidade ou arquitetura; autorização explícita, reversão, evidência antes/depois e suíte pertinente/canônica. |

## Autorização, execução e gates

Cada tarefa delimitada recebe uma autorização única, vinculada ao objetivo, escopo,
workspace, risco e fronteiras declaradas. Uma tarefa não autoriza outra nem permite
ampliar escopo por inferência.

Um único runner conduz a tarefa através das fronteiras declaradas (local, backend,
interface, operação, implantação e publicação). O usuário não transporta estado,
credenciais, resultados ou contexto entre etapas; o runner entrega evidência
vinculada ou encerra em bloqueio.

Gates só são exigidos por risco real, ampliação de autoridade, credencial, ação
destrutiva ou recurso externo. Ações humanas relacionadas são consolidadas em uma
decisão explícita. Após duas tentativas equivalentes sem progresso verificável,
acione o disjuntor, preserve a evidência e peça decisão humana.

A proporcionalidade é obrigatória: localhost usa controles locais mínimos; Preview
usa os gates e a evidência de integração necessários; Production exige autoridade,
credenciais, publicação e reversibilidade explicitamente qualificadas. Nenhum
ambiente herda autoridade de outro.

O GREEN é separado em **código**, **backend**, **interface**, **operação**,
**implantação** e **publicação**, cada qual exigindo evidência independente. O fluxo
humano (entrada, revisão, decisão e recuperação) deve ser validado antes do GREEN
funcional. Melhorias opcionais ficam como `DEFERRED`, com escopo e revisão futura.

## Contrato de execução e conclusão

Antes da execução, defina o contrato de conclusão: objetivo, arquivos, workspace,
ambiente, operações, risco, fronteiras, pós-condição física e evidência necessária.
Uma única autorização vincula todos esses elementos. Um runner contínuo opera dentro
do envelope autorizado através das fronteiras declaradas; o usuário não transporta
manualmente contexto, resultados ou credenciais entre etapas.

Gates existem somente para risco real, autoridade, credenciais, recurso externo,
irreversibilidade ou publicação. Ações humanas relacionadas são consolidadas em um
único gate. Após duas tentativas equivalentes sem progresso verificável, acione o
disjuntor, preserve a evidência e pare em `BLOCKED`.

Dentro do envelope autorizado, a continuação pode ser automática. Reutilize
evidência somente enquanto objeto, hash e ambiente não mudarem. Estados válidos
incluem `BLOCKED`, `WARNING`, `DEFERRED` e `NOT_APPLICABLE`; nenhum deles é GREEN
por inferência. O orçamento de fricção registra gates, tentativas, ações manuais e
mudanças de ambiente.

## Fronteiras físicas e evidência

`localhost`, `Preview` e `Production` são fronteiras independentes. A identidade
física obrigatória do destino inclui URL, branch e SHA remoto; nenhum ambiente herda
autoridade de outro. Antes de qualquer mutação remota, confirme CAS. Depois dela,
confirme a pós-condição física do destino. O relato do executor não é evidência
física: somente observação vinculada ao estado Git, conteúdo e ambiente qualifica o
resultado.

PATCH é o padrão. Preserve fail-closed, autoridade humana, CAS, journal, recovery e
trust boundary; mutação local não autoriza push, merge, tag, release, publicação ou
deploy.

## Inspeção e janelas focadas

Inspecione primeiro o material suficiente para explicar causa raiz, hipótese, risco e mudança proposta. Para arquivos acima de 300 linhas, use janelas focadas quando necessário para segurança ou contexto. O tamanho, por si só, não exige interrupção humana automática nem leitura integral; a janela deve ser ampliada quando a decisão depender de contexto adicional.

Microleituras e operações cobertas pela autoridade vigente podem seguir sem nova aprovação. A IA deve interromper e declarar o bloqueio quando encontrar divergência, autorização insuficiente, risco reclassificado ou evidência que não possa verificar.

## Automação: restrição, não restrição humana

**Automation Restriction, Not Human Restriction** significa limitar o que a automação pode mutar, publicar ou afirmar sem controles adicionais; não significa impedir inspeção humana, exigir confirmações artificiais ou retirar autoridade já concedida. Controles devem incidir sobre a ação automatizada e seu risco, não sobre a pessoa nem sobre cada leitura trivial.

## Validação e entrega

Altere somente o escopo autorizado. Para baixo risco, valide proporcionalmente; para médio risco, valide os consumidores afetados; para alto risco e refatoração, preserve baseline e autorização explícita e execute a suíte pertinente. Não invente resultados, hashes, linhas ou testes. Em divergência, permaneça fail-closed.

Use `sdp_snapshot` do BH-SDP v2.3 em checkpoints relevantes: transferência de sessão, bloqueio, divergência, mudança importante de fase e conclusão relevante. Não é obrigatório emitir snapshot ao final de toda resposta.

Snapshots são incrementais: registram apenas a mudança desde o anterior, a
contagem acumulada de gates e novas âncoras, sem repetir contexto confirmado. O
snapshot preserva fail-closed, autoridade humana, CAS, journal e trust boundary;
ele nunca cria autoridade.


<!-- BEGIN BH-SDP v2.3 -->

# BH-SDP v2.3 — Protocolo de Snapshot e Entrega

## Objetivo

Preservar estado operacional entre sessões por meio de snapshots verificáveis e proporcionais ao risco. O snapshot é um contrato de continuidade, não um ritual obrigatório para cada resposta.

## Quando emitir

Emita `sdp_snapshot` em checkpoints relevantes: transferência de sessão, bloqueio, divergência, conclusão relevante, mudança de fase ou outro ponto em que perder o estado possa causar uma decisão insegura. Uma operação trivial coberta pela autoridade vigente não exige snapshot adicional apenas por ter ocorrido.

## Regras de evidência

- Âncoras devem referenciar dados físicos observáveis, como hash, branch, arquivos e linhas inspecionadas.
- O status de testes deve ser factual. Quando não houver execução ou evidência, use `NÃO_EXECUTADO`; nunca invente PASSOU, FALHOU, hash ou cobertura.
- Declare bloqueios, divergências, limitações e próximo passo. Um snapshot não autoriza uma mutação futura por si só.
- O nível de risco deve refletir a operação e pode ser reavaliado quando o escopo mudar.
- Uma tarefa delimitada tem uma única autorização e um único runner atravessa as
  fronteiras declaradas; o usuário não transporta contexto, credenciais ou
  resultados entre etapas.
- Conte como gate somente risco real, ampliação de autoridade, credencial, ação
  destrutiva ou recurso externo. Consolide ações humanas; após duas tentativas
  equivalentes, registre o disjuntor e aguarde decisão humana.
- Registre proporcionalidade por ambiente (`localhost`, `Preview` ou `Production`)
  e não transfira autoridade entre ambientes.
- GREEN é separado em código, backend, interface, operação, implantação e
  publicação; o fluxo humano validado vem antes do GREEN funcional. Melhorias
  opcionais ficam como `DEFERRED`.
- O risco é da operação, não do projeto; reclassifique quando escopo ou ambiente
  mudar. `localhost`, `Preview` e `Production` são fronteiras independentes.
- Registre o contrato de conclusão, o orçamento de fricção e os estados
  `BLOCKED`, `WARNING`, `DEFERRED` e `NOT_APPLICABLE`. A continuação automática é
  limitada ao envelope autorizado.

## Schema estável

As chaves JSON permanecem em português para compatibilidade entre consumidores multilíngues. O schema v2.3 é:

```json
{
  "nome_do_projeto": "string",
  "versao_do_protocolo": "string",
  "tipo_de_arquitetura": "string",
  "meta_de_custo": "string",
  "fase_atual": "string",
  "nivel_de_risco": "BAIXO | MÉDIO | ALTO",
  "contagem_de_gates": "inteiro não negativo",
  "tentativas_equivalentes": "inteiro não negativo",
  "acoes_manuais": "inteiro não negativo",
  "ambiente": "localhost | Preview | Production",
  "destino_fisico": {
    "url": "string | null",
    "branch": "string | null",
    "sha_remoto": "string | null"
  },
  "estado_green": {
    "codigo": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "backend": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "interface": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "operacao": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "implantacao": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "publicacao": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE"
  },
  "itens_deferred": [
    "string"
  ],
  "ancoras_fisicas": {
    "hash_do_commit": "string",
    "status_dos_testes": "PASSOU | FALHOU | NÃO_EXECUTADO",
    "ultimas_linhas_inspecionadas": "string"
  },
  "componentes_validados": [
    "string"
  ],
  "proximo_passo": "string"
}
```

## Exemplo de checkpoint

```sdp_snapshot
{
  "nome_do_projeto": "surgical-dev-ops",
  "versao_do_protocolo": "BH-SDP-v2.3 / BH-SEP-v2.3 Deterministico",
  "tipo_de_arquitetura": "BH-SMC (Surgical Middleware Core / Harness)",
  "meta_de_custo": "Zero / Mínimo (Open Source / Free Tier)",
  "fase_atual": "Validação documental",
  "nivel_de_risco": "MÉDIO",
  "contagem_de_gates": 0,
  "tentativas_equivalentes": 0,
  "acoes_manuais": 0,
  "ambiente": "localhost",
  "destino_fisico": {
    "url": null,
    "branch": null,
    "sha_remoto": null
  },
  "estado_green": {
    "codigo": "GREEN",
    "backend": "NOT_APPLICABLE",
    "interface": "NOT_APPLICABLE",
    "operacao": "GREEN",
    "implantacao": "NOT_APPLICABLE",
    "publicacao": "NOT_APPLICABLE"
  },
  "itens_deferred": [],
  "ancoras_fisicas": {
    "hash_do_commit": "<HASH_DO_COMMIT_VERIFICADO>",
    "status_dos_testes": "NÃO_EXECUTADO",
    "ultimas_linhas_inspecionadas": "protocols/BH-SEP.md:1-18; protocols/BH-SDP.md:1-25"
  },
  "componentes_validados": [
    "Arquivos normativos v2.3 criados no caminho versionado",
    "Schema JSON validado"
  ],
  "proximo_passo": "Executar validação documental pertinente"
}
```
