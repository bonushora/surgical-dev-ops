# Engenharia de Contexto Cirúrgica: Mitigando Alucinações e Amnésia de LLMs em Produção

## Resumo
O uso de Large Language Models (LLMs) como assistentes de codificação aumentou a velocidade de escrita de código, mas introduziu dois grandes gargalos de engenharia: a *negligência de contexto* (que gera regressões em sistemas complexos) e a *amnésia por exaustão de tokens* (degradação da memória do chat em sessões longas). Este artigo apresenta o ecossistema **Surgical DevOps (BH-SEP e BH-SDP)**, uma abordagem prática e agnóstica de engenharia de prompt que força os modelos de linguagem a operarem por meio de intervenções estritas de código (*Minimal Diffs*) e gerenciamento autônomo de estado em segundo plano (*Snapshots*).

---

## 1. O Paradoxo da Produtividade com LLMs

A integração de assistentes baseados em IA (como GPT-4, Claude e Gemini) ao fluxo de trabalho de desenvolvimento trouxe um ganho inicial inegável de velocidade. No entanto, conforme o projeto escala ou a sessão de chat se estende, a eficiência da ferramenta decai exponencialmente. O desenvolvedor sênior frequentemente se depara com duas patologias sistêmicas:

### 1.1 Negligência de Contexto (O Efeito "Chute")
Diante de uma solicitação de alteração pontual, os modelos tendem a prever tokens reescrevendo funções adjacentes estáveis, alterando assinaturas de métodos homologados ou assumindo estados globais inexistentes. Em sistemas legados ou com regras de negócio complexas (como árvores de componentes aninhadas em Flutter/React ou middlewares de APIs), esse comportamento anula o isolamento do código e introduz regressões silenciosas que sobrecarregam o *code review*.

### 1.2 Amnésia por Exaustão de Tokens (*Context Drift*)
Toda LLM possui um limite físico em sua janela de contexto. À medida que o histórico de uma mesma aba de chat cresce com logs de erro e arquivos colados, o modelo começa a descartar as primeiras instruções da sessão. O sintoma empírico é o esquecimento de regras de negócio combinadas no início do chat, forçando o engenheiro a reexplicar o funcionamento do software repetidamente.

---

## 2. A Solução: Ecossistema Surgical DevOps

Para neutralizar essas falhas de forma agnóstica — sem custos com *fine-tuning* ou infraestrutura complexa —, criamos uma abordagem baseada em protocolos comportamentais operando na camada de tempo de execução (*Prompt System*): o **BH-SEP** e o **BH-SDP**.

[Código Existente (Verdade)] ──> [BH-SEP: Inspeção Total] ──> [BH-SEP: Intervenção Cirúrgica (Diff Mínimo)]
│
[Próximo Chat Limpo] <── [BH-SDP: Hidratação de Contexto] <── [BH-SDP: Snapshot de Estado]


### 2.1 BH-SEP (Safe Evolution Protocol) — A Filosofia "Truth First"
O BH-SEP introduz a filosofia da **Central da Verdade**, estabelecendo que a única fonte confiável de arquitetura é o código preexistente no repositório. O protocolo altera o comportamento padrão da IA através de dois pilares:

1. **Inspect First (Inspecione Primeiro):** O modelo é proibido de sugerir códigos baseados em suposições ou trechos incompletos. Ele deve solicitar e ler a totalidade do arquivo alvo antes de sugerir qualquer modificação.
2. **Minimal Diff (Diferença Mínima):** A intervenção deve ser cirúrgica. A IA é instruída a formular suas respostas no menor formato de bloco de alteração isolado possível, gerando o menor impacto no histórico do Git e blindando as lógicas paralelas.

### 2.2 BH-SDP (Snapshot & Delivery Protocol) — Encapsulamento de Estado Auto-Iniciável
O BH-SDP resolve o problema da volatilidade de memória através do princípio de *Background Tracking*. A IA monitora continuamente em segundo plano os objetivos da sessão e toma a decisão autônoma de emitir um artefato padronizado de persistência — o **Snapshot** — em cenários críticos:

* Ao detectar proximidade com o teto de tokens do chat (evitando o travamento/esquecimento).
* Na homologação de contratos de API ou regras complexas de negócio.
* Mediante comandos de pausa ou mudança de foco do desenvolvedor.

O Snapshot funciona como um arquivo de despejo compactado de estado contendo: objetivo central, arquivos afetados, decisões tomadas e, crucialmente, uma **Diretriz de Retomada Auto-Iniciável** para a próxima IA.

---

## 3. Implementação Prática

Para implantar o ecossistema, o desenvolvedor padroniza o primeiro prompt de qualquer nova sessão enviando uma diretriz que busca os protocolos direto da fonte de controle de versão (GitHub), garantindo que as regras não sofram desvios entre diferentes modelos de mercado.

### 3.1 O Prompt Unificado de Ativação
```text
Acesse simultaneamente as URLs de protocolo em [raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md) e [raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md). Adote de forma estrita, combinada e silenciosa as diretrizes do BH-SEP (Evolução Cirúrgica) e do BH-SDP (Snapshot de Estado) contidas nelas.

Opere como um Engenheiro de Software Sênior especialista no ecossistema do projeto baseado nas regras baixadas. Mantenha o monitoramento ativo em segundo plano e, após compreender os arquivos base fornecidos nas URLs, confirme a activation respondendo estritamente com a mensagem: "BH-SEP E BH-SDP ATIVADOS 🚀". Caso possua um Snapshot de sessão anterior para hidratação de contexto, eu o colarei em seguida. Se não, pergunte qual arquivo ou contexto vamos inspecionar primeiro.
3.2 O Fluxo de Passagem de Bastão (Delivery)
Quando o teto de contexto é atingido ou uma etapa é concluída, a IA gera o bloco isolado em Markdown:

Plaintext
### 📦 BH-SDP AUTOMATIC SNAPSHOT
- **Objetivo Central Atual:** Implementação do Middleware de Cache de Sessão.
- **Últimos Arquivos Alterados/Inspecionados:**
  - `src/middlewares/auth.js`: Adicionado suporte ao header de idempotência.
- **Definições Críticas Estabelecidas (Blindagem):**
  - O cache deve expirar estritamente em 300 segundos.
  - Erros de conexão com o Redis não devem derrubar a requisição (Fail-safe).
- **Status do Ponto de Parada:** Código estruturado, aguardando testes de integração locais.
- **Próximos Passos Sugeridos para Novo Chat:**
  1. Configurar suite de testes em `tests/middleware.test.js`.

---
**DIRETRIZ DE RETOMADA PARA A NOVA IA:** "Baseado no Snapshot acima e sob as regras do BH-SEP, execute imediatamente o Próximo Passo 1 listado, solicitando o arquivo necessário para inspeção."
O desenvolvedor simplesmente copia o bloco gerado, armazena-o em um arquivo de texto adjacente local e, ao abrir um chat limpo, cola-o logo após o prompt de ativação. A nova IA lê a linha final imperativa e inicia o desenvolvimento do caso de teste automaticamente, sem fazer perguntas redundantes ou exigir comandos manuais.

4. Resultados e Conclusão
A aplicação do ecossistema de protocolos altera drasticamente a dinâmica da engenharia assistida. Ao remover a necessidade de auditar códigos redundantes gerados por alucinação e eliminar o tempo gasto reexplicando a arquitetura do sistema, as equipes conseguem fragmentar sessões complexas de desenvolvimento em múltiplos chats isolados de forma totalmente previsível, segura e auditável.
