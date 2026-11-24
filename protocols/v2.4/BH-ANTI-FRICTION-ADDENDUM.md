# BH-SEP / BH-SDP v2.4 — Adendo normativo antifricção

**Ratificação humana:** 23/11/2026 (America/Bahia)
**Tipo:** complemento documental à governança de execução e continuidade.
**Aplicabilidade:** novas missões e escopos cobertos por autoridade; contratos locais mais restritivos prevalecem.

## 1. Precedência e segurança

Este adendo complementa os RAW normativos [BH-SEP v2.4](./BH-SEP.md) e [BH-SDP v2.4](./BH-SDP.md). Não os substitui, altera ou redireciona. As regras integradas de contenção BH-SEP 19–25, as regras de continuidade de contenção do BH-SDP e as políticas do loader confiável prevalecem sobre simplificações de processo.

Nenhuma simplificação relaxa: versão/caminho/SHA-256 do perfil protegido, geração mínima, recusa de fallback permissivo, mediação de credenciais, limites de egress/WebSocket, isolamento nativo, autoridade humana, journal, CAS, anti-replay ou qualificação por ambiente. Snapshot e relatório não conferem nem restauram autoridade.

## 2. BH-SEP — execução proporcional à autoridade

1. **Uma autorização por envelope:** declarar objetivo, pós-condição verificável, escopo/exclusões, workspace/destino, risco, autoridade e evidência. Uma autorização cobre somente os passos previstos, sem extensão por inferência.
2. **Continuação automática delimitada:** um runner autorizado pode consolidar precheck, PATCH mínimo, testes proporcionais, postcheck e entrega. Sem runner, minimizar etapas manuais sem alegar automação inexistente.
3. **Fail-closed localizado:** ausência de autoridade, identidade, evidência ou integridade bloqueia a ação afetada, sem liberar canal alternativo ou impedir tarefas independentes já autorizadas.
4. **Evidência proporcional e reutilizável:** preservar verificações de objeto, hash e ambiente inalterados. Separar integridade, estrutura, semântica, execução e atestação independente; não promover prova entre dimensões.
5. **PATCH e riscos:** usar menor alteração possível. Mudanças em segurança, produção, dados reais, arquitetura executável, contratos públicos ou irreversíveis exigem autorização e qualificação correspondentes.
6. **Orçamento de fricção:** para BAIXO risco, meta de uma autorização, zero confirmações rotineiras intermediárias, uma entrega e um relatório final. MÉDIO/ALTO exigem apenas gates pertinentes ao risco, nunca sua supressão.
7. **Sem qualificações cerimoniais:** não criar milestones, ZIPs, hashes repetidos, revisores ficticiamente independentes ou snapshots por etapa sem nova evidência, hipótese, consumidor, fronteira ou risco. Duas tentativas equivalentes sem progresso acionam disjuntor.
8. **Inspeção focada:** ler material suficiente à hipótese e pós-condição; tamanho do arquivo não cria gate.
9. **Remoto e CAS:** verificar URL, branch e SHA antes de mutações; validar identidade contra SHA esperado e conferir o resultado remoto após o efeito. Nenhum ambiente herda autoridade de outro.
10. **GREEN por dimensão:** código, backend, interface, operação, implantação, publicação, experiência humana, documentação e alegações científicas exigem evidência na dimensão afetada. GREEN_DOCUMENTARY não implica GLOBAL_GREEN.
11. **Terminal interativo:** comandos fornecidos para colagem não devem usar exit, exec substituindo a sessão nem set -e no shell principal. Comunicar falhas de maneira controlada sem fechar o terminal.
12. **Conclusão:** encerrar quando a pós-condição for verificada com prova proporcional, ou registrar BLOCKED com causa. Dependência externa não bloqueia automaticamente trabalho independente autorizado.

## 3. BH-SDP — snapshots somente em checkpoints materiais

1. Emitir sdp_snapshot ao mudar escopo, risco, autoridade, ambiente, sessão ou responsável; em entregas, bloqueio duradouro ou antes de operação ALTO risco quando o contrato exigir. Não emitir a cada microtarefa.
2. Preservar as chaves do schema v2.3 para consumidores. Extensões ficam opcionais até validação e autorização; não alterar contratos existentes por inferência.
3. Reutilizar evidências verificadas sem copiar logs ou reexecutar hashes. Mudanças em objeto, hash, perfil, componente, geração ou ambiente pertinentes exigem revalidação.
4. Nunca promover NÃO_EXECUTADO por inferência, report do executor ou CI genérico; distinguir cada dimensão e evidência física da opinião científica.
5. Registrar URL, branch e SHA antes/depois se houver remoto; quando inaplicável, marcar NOT_APPLICABLE sem inventar valores.
6. Um resumo e um pacote consolidados são suficientes quando cobrem a pós-condição. Snapshot não autoriza execução, publicação, mutação ou fallback desprotegido.

## 4. Transição

As versões históricas, traduções, RAW imutáveis, âncoras e contratos mais restritivos são preservados. Este adendo não muda código executável, perfis confiáveis, credenciais, sandbox, configuração de rede, implantação ou qualificações operacionais. Projetos existentes adotam esta aplicação metodológica apenas dentro de autorizações próprias.

**Limite de conclusão:** publicação documental não equivale a GREEN operacional, avaliação científica independente nem GLOBAL_GREEN.
