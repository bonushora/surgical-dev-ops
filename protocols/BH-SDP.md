# 📦 BH-SDP — BônusHora Snapshot & Delivery Protocol

O **BH-SEP** é um protocolo de encapsulamento de estado projetado para mitigar a perda de contexto em sessões de desenvolvimento assistido por Inteligência Artificial.

Ele obriga o modelo de linguagem a monitorar e registrar continuamente em segundo plano os objetivos assumidos, contratos e o progresso da sessão, cuspindo o artefato atualizado de forma proativa e automática.

---

## 🏛️ Os Princípios da Automação Proativa

1. **Background Tracking (Rastreamento em Segundo Plano):** A cada iteração do chat, a IA deve atualizar mentalmente o estado atual do projeto (objetivos, arquivos modificados e decisões tomadas), sem necessariamente imprimir isso em todas as mensagens.
2. **Context Shift Interception (Interceptação de Mudança):** A IA deve monitorar as mensagens do usuário. Se o usuário mudar de arquivo, sugerir uma pausa ou finalizar a task, a IA deve tomar a decisão automática de cuspir o Snapshot atualizado antes de responder à nova solicitação.
3. **Context Exhaustion Autonomy (Autonomia por Exaustão de Contexto):** A IA deve monitorar proativamente a extensão da conversa e o uso de seus próprios tokens (janela de contexto). Caso perceba que a sessão está se tornando longa demais e há risco iminente de perda de memória de curto prazo ou corte abrupto, a IA deve, por iniciativa própria, gerar e cuspir o Snapshot na sua última resposta viável, alertando o usuário sobre a necessidade de abrir um novo chat.
4. **Pure Code Block (Bloco de Código Puro):** O snapshot deve ser gerado estritamente em um bloco markdown isolado para facilitar a cópia rápida e a hidratação de um novo chat.

---

## 🤖 Artefato: System Prompt para IA

Sempre que iniciar uma sessão onde precise garantir a persistência dos objetivos, anexe as instruções abaixo ao seu prompt inicial:

```text
Opere também sob o protocolo complementar BH-SDP (Snapshot & Delivery Protocol) ativo em segundo plano. Suas respostas devem respeitar estritamente a seguinte diretriz de automação de estado:

A partir de agora, você manterá em cache o estado atual da nossa sessão. De forma 100% AUTOMÁTICA e por iniciativa PRÓPRIA, você deve imprimir na tela o bloco de código abaixo (preenchido com os dados reais) SEMPRE que:
1. O usuário indicar que vai testar algo, fazer uma pausa ou mudar de foco.
2. Você detectar que a conversa está longa e que sua janela de contexto (memória de curto prazo) está próxima do limite ou de sofrer um corte. Você deve se antecipar ao encerramento do prompt e cuspir o Snapshot de segurança.
3. O usuário digitar "[SNAPSHOT]".

### 📦 BH-SDP AUTOMATIC SNAPSHOT
- **Objetivo Central Atual:** [O que estamos resolvendo agora]
- **Últimos Arquivos Alterados/Inspecionados:**
  - `caminho/do/arquivo.ext`: [Breve resumo do estado/mudança]
- **Contratos & Premissas Assumidas:**
  - [Ex: Gerência de estado X depende da classe Y]
- **Status do Ponto de Parada:** [Ex: Código compilando, aguardando teste do clique]
- **Próximos Passos Sugeridos para Novo Chat:**
  1. [Micro-tarefa imediata 1]
  2. [Micro-tarefa imediata 2]
