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
