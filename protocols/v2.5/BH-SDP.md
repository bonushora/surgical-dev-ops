# BH-SDP v2.5 — Snapshot & Delivery Protocol

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

## 🛡️ Regras de continuidade da contenção

1. O snapshot deve registrar o `profile_id`, o SHA-256 do manifesto confiável, a geração observada, a política WebSocket e o estado de qualificação por plataforma quando essas evidências existirem.
2. O registro de contenção no snapshot é apenas evidência de continuidade; ele nunca cria nem restaura autoridade.
3. `profile_id`, manifesto, geração, componentes e ambiente devem ser revalidados fisicamente pelo runtime confiável antes de reutilização.
4. Estado `NÃO_EXECUTADO` não pode ser promovido por inferência, por resultado de outro sistema operacional ou por CI genérico.
5. Mudança de perfil, manifesto, geração, componente, hash ou ambiente invalida reutilização da evidência de contenção.
6. Snapshot anterior não pode habilitar fallback, WebSocket, credencial, rede, mutação ou publicação que o perfil atual não qualifique explicitamente.

## ⚙️ BH-SDP v2.5 — Efeitos normativos de continuidade antifricção

As regras abaixo integram o próprio BH-SDP v2.5. O schema do sdp_snapshot acima permanece compatível com consumidores anteriores; não são exigidas novas chaves para snapshots existentes.

7. **Checkpoints materiais, não cerimoniais:** emitir snapshot em entrega final, troca relevante de sessão, risco, ambiente, escopo, autoridade ou responsável, bloqueio duradouro e fronteira de alto risco que exija recuperação. Não gerar snapshot a cada resposta, microtarefa ou gate já coberto.
8. **Continuidade verificável:** snapshots devem incluir referências físicas disponíveis e os estados já provados. Evidência de objeto, hash, perfil, geração e ambiente inalterados pode ser referenciada sem nova execução; alteração relevante exige revalidação.
9. **Um pacote de continuidade:** consolidar contexto, decisão, evidências e próximo passo em um único artefato proporcional; não repetir logs ou transportar manualmente credenciais entre etapas do mesmo runner autorizado.
10. **Sem promoção por inferência:** resultado NÃO_EXECUTADO nunca vira PASSOU por relato, memória, CI genérico ou snapshot; falhas em uma dimensão não eliminam a possibilidade de continuar atividades independentes autorizadas.
11. **Identidade remota:** quando houver operação remota, registrar URL, branch e SHA antes/depois, condicionados a CAS. Quando não houver remoto, usar NOT_APPLICABLE justificado sem fabricar SHA.
12. **Escopo e orçamento de fricção:** registrar excepcionalmente intervenções, gates e tentativas materiais, sem forçar novos checkpoints; ao exceder o orçamento justificar a interrupção. O snapshot não é fonte de autoridade.
13. **Contenção preservada:** as regras 1–6 de continuidade da contenção acima permanecem integrais e prevalecem quando houver conflito. Não há migração automática do perfil protegido v2.4 para v2.5.

**Regra de transição:** publicação normativa documental não prova ativação no runtime, nem modifica contratos ou arquivos históricos, credenciais, rede ou permissões.
