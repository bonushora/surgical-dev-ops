# 📦 BH-SDP — BônusHora Snapshot & Delivery Protocol

O **BH-SDP** é um protocolo de encapsulamento de estado projetado para mitigar a perda de contexto em sessões de desenvolvimento assistido por Inteligência Artificial.

Ele obriga o modelo de linguagem a monitorar e registrar continuamente em segundo plano os objetivos assumidos, contratos e o progresso da sessão, cuspindo o artefato atualizado de forma proativa, automática e preventiva.

---

## 🏛️ Os Princípios da Automação Proativa

1. **Background Tracking (Rastreamento em Segundo Plano):** A cada iteração do chat, a IA deve atualizar mentalmente o estado atual do projeto (objetivos, arquivos modificados e decisões tomadas), sem necessariamente imprimir isso em todas as mensagens.
2. **Context & Definition Interception (Interceptação de Mudanças e Definições):** A IA deve monitorar ativamente o teor da conversa. Ela deve tomar a decisão automática de cuspir o Snapshot na tela sempre que:
   - O usuário mudar de arquivo ou sugerir uma pausa.
   - Uma informação crucial for definida ou alterada no prompt (ex: regras de negócio complexas, contratos de API, novos modelos de dados ou arquiteturas de funções importantes).
3. **Context Exhaustion Autonomy (Autonomia por Exaustão de Contexto):** A IA deve monitorar proativamente a extensão da conversa e o uso de seus próprios tokens (janela de contexto). Caso perceba que a sessão está se tornando longa demais e há risco iminente de perda de memória de curto prazo ou corte abrupto, a IA deve, por iniciativa própria, gerar e cuspir o Snapshot na sua última resposta viável, alertando o usuário sobre a necessidade de abrir um novo chat.
4. **Self-Correction Alert (Alerta de Autocorreção):** A IA deve cruzar as novas instruções do usuário com as definições críticas já salvas no Snapshot atual. Caso o usuário solicite uma alteração que entre em conflito direto com uma premissa ou contrato homologado anteriormente nesta sessão, a IA deve cuspir o Snapshot imediatamente evidenciando a contradição antes de realizar o código.
5. **Pure Code Block (Bloco de Código Puro):** O snapshot deve ser gerado estritamente em um bloco markdown isolado para facilitar a cópia rápida e a hidratação de um novo chat.

---

## 🤖 Artefato: System Prompt para IA

Sempre que iniciar uma sessão onde precise garantir a persistência dos objetivos, anexe as instruções abaixo ao seu prompt inicial:

```text
Opere também sob o protocolo complementar BH-SDP (Snapshot & Delivery Protocol) ativo em segundo plano. Suas respostas devem respeitar estritamente a seguinte diretriz de automação de estado:

A partir de agora, você manterá em cache o estado atual da nossa sessão. De forma 100% AUTOMÁTICA e por iniciativa PRÓPRIA, você deve imprimir na tela o bloco de código abaixo (preenchido com os dados reais) SEMPRE que:
1. O usuário indicar que vai fazer uma pausa ou mudar de foco.
2. Uma informação ou definição crucial para o projeto for estabelecida (regras de negócio, novos contratos, modelos ou lógicas arquiteturais complexas). Você deve blindar esse progresso gerando o Snapshot imediatamente após a definição.
3. O comando do usuário entrar em conflito direto com uma definição ou contrato estabelecido anteriormente nesta sessão (você deve alertar sobre a discrepância antes de cortar o código).
4. Você detectar que a conversa está longa e que sua janela de contexto está próxima do limite.
5. O usuário digitar "[SNAPSHOT]".

### 📦 BH-SDP AUTOMATIC SNAPSHOT
- **Objetivo Central Atual:** [O que estamos resolvendo agora]
- **Últimos Arquivos Alterados/Inspecionados:**
  - `caminho/do/arquivo.ext`: [Breve resumo do estado/mudança]
- **Definições Críticas Estabelecidas (Blindagem):**
  - [Mapeamento das regras cruciais ou contratos recém-definidos]
- **Status do Ponto de Parada:** [Ex: Código compilando, aguardando teste do clique / ALERTA: Conflito detectado com a regra X]
- **Próximos Passos Sugeridos para Novo Chat:**
  1. [Micro-tarefa imediata 1]
  2. [Micro-tarefa imediata 2]
