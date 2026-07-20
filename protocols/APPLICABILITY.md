# 🎯 Guia de Aplicabilidade e Casos de Uso — Ecossistema BH

Os protocolos **BH-SEP (Safe Evolution Protocol)** e **BH-SDP (Snapshot & Delivery Protocol)** são agnósticos. Embora tenham nascido no ecossistema Flutter com o projeto BônusHora, as dores que eles curam são universais no desenvolvimento de software moderno assistido por Inteligência Artificial.

Eles atuam de forma combinada: enquanto o BH-SEP dita *como* a IA deve alterar o código de forma cirúrgica, o BH-SDP dita *como* a IA deve gerenciar a própria memória para que o conhecimento estratégico do projeto nunca seja perdido entre as sessões de chat.

---

## 🎯 Em quais situações aplicar?

### Protocolo BH-SEP (Evolução Cirúrgica)
* **Manutenção de Sistemas Legados ou em Produção:** Situações onde o código já está rodando e o risco de quebrar regras de negócio ocultas é altíssimo. A IA não pode "chutar" a arquitetura; ela precisa ler a verdade primeiro.
* **Refatorações de Arquivos Complexos:** Quando um arquivo gerencia estados complexos, árvores de componentes muito aninhadas (como Flutter ou React) ou conexões diretas com banco de dados. O princípio do **Minimal Diff** impede que a IA destrua lógicas paralelas.
* **Onboarding de Novos Desenvolvedores (ou Novas IAs) no Projeto:** Quando um programador entra em um projeto existente ou quando você abre um chat do zero, o protocolo serve como a barreira de contexto para que ninguém comece a sugerir alterações às cegas.
* **Correção de Bugs Críticos (Hotfixes):** Cenários de pressão onde o desenvolvedor precisa de uma intervenção cirúrgica rápida sem o risco de gerar efeitos colaterais ou regressões em outras partes do sistema.

### Protocolo BH-SDP (Snapshot Automático de Estado)
* **Detecção de Exaustão de Contexto (Limite de Memória):** Quando a conversa se estende demais e a IA calcula que sua própria janela de tokens está próxima do teto. Ela se antecipará ao esquecimento ou travamento e cuspirá o Snapshot preventivamente, alertando que é hora de migrar para um novo chat.
* **Homologação de Definições Críticas:** No exato momento em que você e a IA chegarem a um consenso sobre uma regra de negócio complexa, uma nova arquitetura de funções ou um contrato de API específico. Ela blindará essa "conquista" cuspindo o artefato imediatamente na próxima resposta para que essa lógica seja eternizada.
* **Sinalização de Pausas ou Mudanças de Foco:** Assim que você digitar comandos contextuais como *"vou testar"*, *"vou almoçar"* ou *"mudei de arquivo"*. A IA intercepta o gatilho e entrega o estado compactado do projeto antes de você se ausentar.
* **Alertas de Discrepância e Contradição:** Caso você peça uma alteração que viole um contrato ou premissa de negócio estabelecida mensagens atrás. A IA interromperá o fluxo e cuspirá o Snapshot realçando a contradição para que você decida se deseja sobrescrever a regra ou corrigir a instrução.
* **Invocação Manual Direta:** Sempre que você precisar encerrar a sessão imediatamente e digitar o comando cirúrgico `[SNAPSHOT]`.

---

## 💻 Para quais aplicações e ecossistemas?

O ecossistema se encaixa perfeitamente em qualquer stack de tecnologia, com destaque para:

* **Aplicações Mobile (Flutter, React Native, Swift, Kotlin):** Onde o fluxo de navegação, ciclo de vida de telas e injeção de dependências mudam drasticamente entre arquivos.
* **Aplicações Web Single Page (React, Vue, Angular, Next.js):** Sistemas que possuem muitos subcomponentes compartilhando o mesmo estado global. O princípio do **Preserve Everything** garante que a IA não quebre os contratos desses componentes adjacentes.
* **Desenvolvimento de APIs e Back-end (Node.js, Python/FastAPI, Go, Java):** Onde contratos de rotas, middlewares, payloads de requisições e segurança não podem ser alterados ou "reinventados" pela IA durante a criação de um novo endpoint.
* **Projetos de Infraestrutura como Código (Terraform, Ansible, Dockerfiles):** Onde uma única linha alterada incorretamente pela IA pode derrubar um ambiente inteiro ou expor portas de segurança.

---

## 💾 Como coletar e reaproveitar o artefato do BH-SDP?

O fluxo de passagem de bastão é simples, manual e à prova de falhas de IA:

1. **Copiar o Bloco Puro:** Assim que a IA tomar a decisão automatizada de cuspir o Snapshot na tela do chat dentro de uma caixa cinza de código Markdown, clique no botão de cópia do próprio chat.
2. **Armazenar Localmente:** Cole temporariamente esse conteúdo em um **bloco de notas ou arquivo de texto adjacente** (`snapshot.txt` ou rascunho temporário do seu editor de código).
3. **Hidratar o Próximo Prompt:** Ao abrir uma aba de chat completamente limpa, inicie a conversa colando o comando de ativação unificado seguido do bloco de texto salvo do seu arquivo adjacente.

---

> 💡 **Resumo da Ópera:** O acoplamento do BH-SEP com o BH-SDP transforma a IA de uma geradora de códigos genéricos em um braço direito cirúrgico de engenharia. Ele garante que você possa fragmentar o desenvolvimento em quantos prompts forem necessários, sem que a IA sofra de amnésia e sem que você precise reexplicar o projeto do zero a cada novo chat.
