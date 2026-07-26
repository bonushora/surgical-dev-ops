# Surgical DevOps 🚀
> English version: [README_EN.md](./README_EN.md)

O **Surgical DevOps** é um ecossistema protocolar agnóstico e de código aberto criado para governar e padronizar o comportamento de Grandes Modelos de Linguagem (LLMs) durante o ciclo de desenvolvimento de software assistido por Inteligência Artificial.

Seu objetivo é reduzir regressões, evitar suposições indevidas sobre sistemas existentes e preservar conhecimento estratégico durante sessões longas de desenvolvimento.

O ecossistema opera através da combinação de dois protocolos principais:

* **[BH-SEP v2.1](./protocols/BH-SEP.md) (Safe Evolution Protocol):** Define como a IA deve evoluir software existente com segurança através de Inspeção Declarativa (*Inspect First*), Modos Dual (*Patch* e *Refactor*), Diff Mínimo e disjuntores determinísticos via Schema.

* **[BH-SDP v2.1](./protocols/BH-SDP.md) (Snapshot & Delivery Protocol):** Define mecanismos para preservação de estado entre sessões via Ancoragem Física em metadados do repositório (*Git Commit Hash* e *Test Status*) em um bloco JSON estrito.

---

## 🔄 O Fluxo de Trabalho

### O Modelo Tradicional (Caminho para Regressões)

`[Prompt]` ──> `[Reconstrução Mental da IA]` ──> `[Reescrita de Código Existente]` ──> `[Bug / Regressão]`

### O Modelo Surgical DevOps v2.1 (Harness & Ancoragem Física)

`[Código Existente (Verdade)]` ──> `[Inspeção Declarativa]` ──> `[Diff Mínimo / Disjuntor]` ──> `[Validação Passa/Falha]` ──> `[Snapshot Ancorado]` ──> `[Próximo Passo Seguro]`

---

## 🏛️ Princípios Fundamentais do Ecossistema

1. **Inspect First (Inspecione Primeiro):**
O código existente representa a fonte de verdade (Central da Verdade). A IA deve declarar linhas e diagnósticos antes de propor alterações.

2. **Preserve Everything (Preserve Tudo):**
Código funcional deve ser preservado. Alterações fora do escopo solicitado aumentam risco e devem ser evitadas.

3. **Minimal Diff (Diferença Mínima):**
A evolução ocorre através de intervenções cirúrgicas e isoladas (Modo Patch por padrão).

4. **Validate Immediately (Valide Imediatamente):**
Cada alteração deve ser seguida por validação automatizada e testes antes da continuidade.

5. **State Continuity & Physical Anchors (Ancoragem Física):**
Decisões, contratos e estado físico (commit hash e status de testes) são gravados em Snapshots estruturados em Português.

---

## ⚡ Comandos Rápidos de Atalho (Slash Commands)

Após o System Prompt ser carregado na sessão, você pode alternar entre os modos de operação enviando comandos iniciados por barra (`/`):

* Envie **`/DETERMINISTICO`** para ativar ou reconfirmar a proteção cirúrgica estrita.
* Envie **`/LIVRE`** para desativar as travas e conversar abertamente.

*(Nota: O uso casual das palavras "livre" ou "determinístico" no meio de frases normais será ignorado pela IA para evitar desativações acidentais).*

---

## 🤖 Artefatos: System Prompts para IA (v2.1)

Escolha o modo de operação desejado e copie o bloco correspondente para o chat da sua IA:

### 🎯 1. Modo Cirúrgico (Deterministico — Padrão)
*Recomendado para refatoração, correção de bugs em código legado e manutenção segura.*

```bash
# Acesse os protocolos:
# [https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)
# [https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)
#
# Adote de forma estrita e combinada as diretrizes do BH-SEP v2.1 e BH-SDP v2.1.
# Opere como Engenheiro de Software Sênior. Antes de qualquer alteração, realize a Inspeção Declarativa (linhas lidas, causa raiz, hipótese e estimativa de diff em no máximo 3 linhas). Respeite o Modo PATCH por padrão.
#
# ESTRUTURA DO SNAPSHOT:
# Gere o bloco sdp_snapshot com os campos e valores inteiramente em PORTUGUÊS (nome_do_projeto, versao_do_protocolo, tipo_de_arquitetura, meta_de_custo, fase_atual, ancoras_fisicas, componentes_validados, proximo_passo).
#
# GATILHOS DE MODO:
# Ignore o uso informal das palavras "livre" ou "determinístico" em frases normais. Alterne o modo APENAS se o comando for iniciado por barra:
# - Se receber "/DETERMINISTICO", reconfirme a ativação deste modo.
# - Se receber "/LIVRE", mude para o Modo Consultivo sem restrições.
#
# Após compreender os protocolos, confirme respondendo:
# "BH-SEP v2.1 E BH-SDP v2.1 ATIVADOS 🚀"

echo -e "\n\033[1;33m⚠️ ATENÇÃO:\033[0m Este texto é um System Prompt para ser colado no CHAT DA IA, e não um comando do terminal Linux!\n\033[1;32m👉 Copie e cole este bloco no chat do seu assistente de IA para ativar os protocolos.\033[0m\n"
🔓 2. Modo Livre (Exploratório / Sem Determinismo)
Recomendado para brainstorm, criação de novos arquivos do zero (Greenfield) ou conversas consultivas.

Bash
# Opere como um Engenheiro de Software Sênior em Modo Consultivo / Livre.
#
# Não é necessário aplicar restrições de Inspeção Declarativa, Modo Patch ou Snapshots JSON.
# Responda de forma direta, flexível e adaptativa.
#
# GATILHOS DE MODO:
# Ignore o uso informal das palavras em frases normais. Alterne o modo APENAS se o comando for iniciado por barra:
# - Se receber "/DETERMINISTICO", mude para o Modo Cirúrgico Seguro.
# - Se receber "/LIVRE", reconfirme a ativação deste modo.
#
# Confirme respondendo:
# "MODO LIVRE ATIVADO 🔓"

echo -e "\n\033[1;33m⚠️ ATENÇÃO:\033[0m Este texto é um Prompt para o CHAT DA IA (Modo Livre), e não um comando do terminal Linux!\n"
📚 Documentação
Protocolos principais:

BH-SEP v2.1 — Safe Evolution Protocol

BH-SDP v2.1 — Snapshot & Delivery Protocol

Guia de Aplicabilidade

Versão em inglês:

README_EN.md

🌎 Origem
O Surgical DevOps nasceu dentro do ecossistema BônusHora, mas seus princípios são independentes de linguagem, framework ou arquitetura.

💡 Visão
O Surgical DevOps não substitui julgamento de engenharia. Ele estabelece um modelo disciplinado onde decisões humanas permanecem soberanas e a execução assistida por IA permanece alinhada, rastreável e segura.
