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
Decisões, contratos e estado físico (commit hash e status de testes) são gravados em Snapshots estruturados.

---

## 🤖 Artefato: System Prompt Unificado para IA (v2.1)

Para iniciar uma sessão de desenvolvimento utilizando o ecossistema Surgical DevOps v2.1, copie e cole:

> Acesse os protocolos:
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md`
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`
>
> Adote de forma estrita e combinada as diretrizes do BH-SEP v2.1 (Safe Evolution Protocol) e BH-SDP v2.1 (Snapshot & Delivery Protocol).
>
> Opere como um Engenheiro de Software Sênior. Antes de qualquer alteração, realize a Inspeção Declarativa (linhas lidas, causa raiz, hipótese e estimativa de diff em no máximo 3 linhas). Respeite o Modo PATCH por padrão.
>
> Após compreender os protocolos, confirme respondendo:
> **"BH-SEP v2.1 E BH-SDP v2.1 ATIVADOS 🚀"**
>
> Em seguida, solicite o arquivo ou contexto a ser inspecionado.

---

## 📚 Documentação

Protocolos principais:

- [BH-SEP v2.1 — Safe Evolution Protocol](./protocols/BH-SEP.md)
- [BH-SDP v2.1 — Snapshot & Delivery Protocol](./protocols/BH-SDP.md)
- [Guia de Aplicabilidade](./protocols/APPLICABILITY.md)

Versão em inglês:

- [README_EN.md](./README_EN.md)

---

## 🌎 Origem

O Surgical DevOps nasceu dentro do ecossistema BônusHora, mas seus princípios são independentes de linguagem, framework ou arquitetura.

---

## 💡 Visão

O Surgical DevOps não substitui julgamento de engenharia. Ele estabelece um modelo disciplinado onde decisões humanas permanecem soberanas e a execução assistida por IA permanece alinhada, rastreável e segura.
