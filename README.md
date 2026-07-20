# Surgical DevOps 🚀

O **Surgical DevOps** é um ecossistema protocolar agnóstico e de código aberto projetado para governar e padronizar o comportamento de Grandes Modelos de Linguagem (LLMs) durante o ciclo de desenvolvimento de software, eliminando regressões e a perda de histórico em chats longos.

O ecossistema opera através do acoplamento de dois protocolos principais:

* **BH-SEP (Safe Evolution Protocol):** Força a IA a agir de maneira cirúrgica. Ela é proibida de assumir contextos ou reescrever arquivos funcionais inteiros. O foco é a leitura total do arquivo alvo (*Inspect First*) seguida de alterações pontuais e isoladas (*Minimal Diffs*).
* **BH-SDP (Snapshot & Delivery Protocol):** Gerencia a memória de curto prazo do modelo. A própria IA rastreia seu consumo de tokens e emite um ponto de parada estruturado (*Snapshot*) para que o desenvolvedor possa transferir o progresso para uma nova sessão limpa sem sofrer com a amnésia ou alucinações por exaustão de contexto.

---

## 🔄 O Fluxo de Trabalho

### O Modelo Tradicional (Caminho para o Caos)
`[Prompt]` ──> `[Reconstrução Mental da IA]` ──> `[Gera Arquivo Inteiro Novo]` ──> `[Bug / Regressão]`

### O Modelo BH-SEP + BH-SDP (Evolução Segura e Persistente)
`[Código Existente (Verdade)]` ──> `[Inspeção Completa]` ──> `[Diff Mínimo]` ──> `[Validação/Check]` ──> `[Background Snapshot]` ──> `[Próximo Passo]`

---

## 🏛️ Os Princípios Fundamentais do Ecossistema

1. **Inspect First (Inspecione Primeiro):** A verdade absoluta é o código existente. Nunca assuma contratos, rotas ou gerência de estado. A IA deve ler o arquivo inteiro antes de propor qualquer alteração.
2. **Preserve Everything (Preserve Tudo):** O código que já funciona é sagrado. Não reformatar, não organizar e não tentar "melhorar" trechos adjacentes sem solicitação explícita.
3. **Minimal Diff (Diferença Mínima):** Intervenção cirúrgica pura. Alterar única e exclusivamente o bloco necessário para a feature ou correção, gerando o menor impacto possível no histórico do Git.
4. **Validate Immediately (Valide Imediatamente):** Parada obrigatória após cada alteração. Executar ferramentas de lint/análise e testes de navegação antes de dar qualquer passo adiante.
5. **Advance Incrementally (Avance em Pequenos Passos):** Quebrar problemas complexos em micro-etapas. Só avançar para o passo B após o passo A estar consolidado e validado em produção/stg.
6. **Continuous State Tracking (Rastreamento Contínuo):** A IA deve rastrear em segundo plano premissas, regras de negócio e pontos de parada estabelecidos, agindo preventivamente contra a degradação da sua própria memória.

---

## 🤖 Artefato: System Prompt Unificado para IA

Sempre que iniciar uma nova sessão de desenvolvimento, copie, cole e envie o comando abaixo como o primeiro prompt do chat para ativar todo o ecossistema protocolar:

> Acesse simultaneamente as URLs de protocolo em `raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md` e `raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`. Adote de forma estrita, combinada e silenciosa as diretrizes do BH-SEP (Evolução Curúrgica) e do BH-SDP (Snapshot de Estado) contidas nelas.
>
> Opere como um Engenheiro de Software Sênior especialista no ecossistema do projeto baseado nas regras baixadas. Mantenha o monitoramento ativo em segundo plano e, após compreender os arquivos base fornecidos nas URLs, confirme a ativação respondendo estritamente com a mensagem: "BH-SEP E BH-SDP ATIVADOS 🚀". Caso possua um Snapshot de sessão anterior para hidratação de contexto, eu o colarei em seguida. Se não, pergunte qual arquivo ou contexto vamos inspecionar primeiro.
