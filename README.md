O **BH-SEP** é um protocolo de engenharia projetado para mitigar o maior gargalo do desenvolvimento assistido por Inteligência Artificial: a alucinação por negligência de contexto (quando a IA tenta adivinhar ou reescrever arquivos inteiros, gerando regressões).

Ele introduz a filosofia da **Central da Verdade** no fluxo de iteração, forçando o modelo de linguagem a trabalhar como um cirurgião: inspecionar antes de cortar, intervir minimamente e validar imediatamente.

O **BH-SDP** é um protocolo de encapsulamento de estado projetado para mitigar a perda de contexto e o esquecimento em sessões longas de engenharia assistida por IA. 

Ele força o modelo a agir como um observador proativo do escopo em tempo real, monitorando a própria janela de tokens e definições arquiteturais complexas para gerar checkpoints (*Snapshots*) automáticos e auto-iniciáveis antes de qualquer interrupção ou teto de memória.

---

## 🔄 O Fluxo de Trabalho

### O Modelo Tradicional (Caminho para o Caos)
[Prompt] ──> [Reconstrução Mental da IA] ──> [Gera Arquivo Inteiro Novo] ──> [Bug / Regressão]


### O Modelo BH-SEP + BH-SDP (Evolução Segura e Persistente)
[Código Existente (Verdade)] ──> [Inspeção Completa] ──> [Diff Mínimo] ──> [Validação/Check] ──> [Background Snapshot] ──> [Próximo Passo]


---

## 🏛️ Os Princípios Fundamentais do Ecossistema

1. **Inspect First (Inspecione Primeiro):** A verdade absoluta é o código existente. Nunca assuma contratos, rotas ou gerência de estado. A IA deve ler o arquivo inteiro antes de propor qualquer alteração.
2. **Preserve Everything (Preserve Tudo):** O código que já funciona é sagrado. Não reformatar, não organizar e não tentar "melhorar" trechos adjacentes sem solicitação explícita.
3. **Minimal Diff (Diferença Mínima):** Intervenção cirúrgica pura. Alterar única e exclusivamente o bloco necessário para a feature ou correção, gerando o menor impacto possível no histórico do Git.
4. **Validate Immediately (Valide Inmediatamente):** Parada obrigatória após cada alteração. Executar ferramentas de lint/análise (ex: `flutter analyze`) e testes de navegação antes de dar qualquer passo adiante.
5. **Advance Incrementally (Avance em Pequenos Passos):** Quebrar problemas complexos em micro-etapas. Só avançar para o passo B após o passo A estar consolidado e validado em produção/stg.
6. **Continuous State Tracking (Rastreamento Contínuo):** A IA deve rastrear em segundo plano premissas, regras de negócio e pontos de parada estabelecidos, agindo preventivamente contra a degradação da sua própria memória.

---

## 🤖 Artefato: System Prompt Unificado para IA

Sempre que iniciar uma nova sessão de desenvolvimento, copie, cole e envie o comando abaixo como o primeiro prompt do chat para ativar todo o ecossistema protocolar:

```text
Acesse simultaneamente as URLs de protocolo em <kbd>[raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)</kbd> e <kbd>[raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)</kbd>. Adote de forma estrita, combinada e silenciosa as diretrizes do BH-SEP (Evolução Cirúrgica) e do BH-SDP (Snapshot de Estado) contidas nelas.

Opere como um Engenheiro de Software Sênior especialista no ecossistema do projeto baseado nas regras baixadas. Mantenha o monitoramento ativo em segundo plano e, após compreender os arquivos base fornecidos nas URLs, confirme a ativação respondendo estritamente com a mensagem: "BH-SEP E BH-SDP ATIVADOS 🚀". Caso possua um Snapshot de sessão anterior para hidratação de contexto, eu o colarei em seguida. Se não, pergunte qual arquivo ou contexto vamos inspecionar primeiro.
