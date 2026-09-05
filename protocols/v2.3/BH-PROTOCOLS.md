# BH-SEP v2.3 — Safe Evolution Protocol

## 🎯 Objetivo
Governar a evolução assistida por IA com segurança proporcional ao risco, preservando autoridade humana, previsibilidade e evidência física. Esta versão adota governança sem fricção: os controles protegem decisões e mutações relevantes sem transformar toda operação em uma interrupção.

## 🏛️ Diretrizes Fundamentais
1. **Contrato de conclusão:** no início de cada tarefa, declare o resultado esperado, o escopo, o ambiente, o destino físico, a evidência necessária e a condição objetiva de conclusão. Uma tarefa só está concluída quando essa pós-condição for fisicamente verificada.
2. **Autoridade humana:** a IA pode analisar e propor, mas não amplia autorização nem substitui decisão humana exigida pelo contexto.
3. **Fail-closed e estados explícitos:** diante de autoridade ausente, evidência insuficiente, divergência ou regra ambígua, não execute a mutação; declare `BLOCKED`. Use `WARNING` para risco ou limitação sem bloqueio imediato, `DEFERRED` para melhoria autorizadamente adiada e `NOT_APPLICABLE` quando um controle não se aplicar, sempre com justificativa.
4. **PATCH por padrão:** alterações devem ser mínimas e localizadas. Refatoração exige autorização humana explícita.
5. **Evidência física:** afirmações sobre estado, linhas, testes, Git ou artefatos devem se apoiar em evidência observável. O relato do executor, por si só, não é evidência física; evidência ausente é `NÃO_EXECUTADO`, nunca uma inferência apresentada como fato.
6. **Reutilização de evidência:** reutilize evidência já verificada enquanto objeto, hash e ambiente não mudarem. Qualquer mudança nesses três elementos invalida a evidência e exige nova inspeção ou validação.
7. **Continuação automática delimitada:** continue automaticamente dentro do envelope autorizado, sem nova aprovação para cada passo coberto por ele. Pare em `BLOCKED`, em ampliação de escopo, em reclassificação de risco ou quando a autoridade deixar de cobrir a próxima ação.
8. **Red-to-Green:** antes de uma refatoração ou mudança de alto risco, verifique a baseline pertinente; depois, valide a alteração até GREEN ou declare o bloqueio.
9. **Governança proporcional ao risco:** classifique a operação antes de mutar e aplique o quadro abaixo:
   - **BAIXO:** características: documentação, leitura, ajuste localizado ou operação já coberta pela autoridade vigente; exemplos: alteração Markdown, microleitura, parse e lint documental; autorização/gates: autorização vigente, sem novo gate salvo recurso externo que exija credencial, custo, consentimento, mutação ou nova autoridade; validação exigida: inspeção do contexto e validação proporcional, como lint, parse ou teste documental.
   - **MÉDIO:** características: mudança com consumidores, comportamento ou dependências limitados; exemplos: alteração de contrato interno, integração delimitada, mudança com impacto conhecido ou publicação reversível protegida por CAS; autorização/gates: autorização vinculada a objetivo, causa ou hipótese, escopo, risco e arquivos, com gates para risco real ou autoridade adicional; validação exigida: validação direcionada dos consumidores e registro da evidência.
   - **ALTO:** características: refatoração, arquitetura, segurança, dados, contrato público ou efeito operacional amplo; exemplos: Production, irreversibilidade, credencial sensível, dados reais, ação destrutiva, contrato público crítico ou alteração transversal; autorização/gates: baseline prévia, plano explícito, autorização humana específica e gates correspondentes antes da mutação; validação exigida: validação abrangente, pós-condição física e evidência independente de cada dimensão afetada.
10. **Autorização e fronteiras:** cada tarefa delimitada recebe uma autorização única, vinculada ao objetivo, escopo, workspace, risco e fronteiras declaradas. Uma tarefa não autoriza outra nem permite ampliar escopo por inferência; um único runner atravessa as fronteiras declaradas. O usuário não deve transportar manualmente contexto, resultados ou credenciais entre etapas cobertas pelo runner.
11. **Orçamento de fricção:** defina um orçamento de fricção proporcional ao risco, contando aprovações, gates, interrupções e ações manuais. Não consuma fricção com confirmações artificiais; ao exceder o orçamento, reavalie o risco, consolide a decisão humana ou declare `BLOCKED`.
12. **Gates e proporcionalidade:** gates são exigidos por risco real, ampliação de autoridade, credencial, ação destrutiva ou recurso externo que exija credencial, custo, consentimento, mutação ou nova autoridade. Consolide ações humanas relacionadas; após duas tentativas equivalentes sem progresso verificável, acione o disjuntor e peça decisão humana. Nenhum ambiente herda autoridade de outro.
13. **Inspeção e janelas focadas:** inspecione material suficiente para explicar causa raiz, hipótese, risco e mudança proposta. Para arquivos acima de 300 linhas, use janelas focadas quando necessário; o tamanho, por si só, não exige interrupção humana automática nem leitura integral.
14. **Identidade física do remoto:** toda operação remota deve registrar e conferir a identidade física composta por URL, branch e SHA observado. A identidade não pode ser substituída por nome, relato ou inferência.
15. **CAS e pós-condição remota:** antes de qualquer mutação remota, valide CAS contra a identidade física esperada. Depois da mutação, verifique a pós-condição física no remoto, incluindo o SHA resultante, branch, URL e artefatos esperados; falha ou divergência é `BLOCKED`.
16. **Automação sem restringir a autoridade humana:** limite o que a automação pode mutar, publicar ou afirmar sem controles adicionais, sem impedir inspeção humana, exigir confirmações artificiais ou retirar autoridade já concedida.
17. **GREEN independente e experiência humana:** trate código, backend, interface, operação, implantação e publicação como dimensões separadas, cada uma com evidência independente. Valide também a experiência humana — entrada, revisão, decisão, feedback, recuperação e compreensão do estado — antes do GREEN funcional; melhorias opcionais permanecem `DEFERRED`, com escopo e revisão futura.
18. **Validação e entrega:** altere somente o escopo autorizado e valide proporcionalmente ao risco. Não invente resultados, hashes, linhas ou testes. Em divergência, permaneça fail-closed. Use `sdp_snapshot` em checkpoints relevantes; snapshots incrementais preservam autoridade humana, CAS, journal e trust boundary, mas nunca criam autoridade.

---

# BH-SDP v2.3 — Snapshot & Delivery Protocol

## 🎯 Objetivo
Preservar o estado operacional entre sessões por meio de snapshots verificáveis e proporcionais ao risco. O snapshot é um contrato de continuidade, não um ritual obrigatório para cada resposta.

## 📋 Schema do Snapshot (`sdp_snapshot`)

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
  "acoes_manuais": [
    "string"
  ],
  "ambiente": "localhost | Preview | Production",
  "destino_fisico": {
    "url": "string",
    "branch": "string",
    "sha_antes": "string",
    "sha_depois": "string"
  },
  "estado_green": {
    "codigo": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "backend": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "interface": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "operacao": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "implantacao": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "publicacao": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "experiencia_humana": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE"
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
