# Surgical DevOps 🚀
> English version: [README_EN.md](./README_EN.md)


O **Surgical DevOps** é um ecossistema protocolar agnóstico e de código aberto criado para governar e padronizar o comportamento de Grandes Modelos de Linguagem (LLMs) durante o ciclo de desenvolvimento de software assistido por Inteligência Artificial.

Seu objetivo é reduzir regressões, evitar suposições indevidas sobre sistemas existentes e preservar conhecimento estratégico durante sessões longas de desenvolvimento.

O ecossistema opera através da combinação de dois protocolos principais:

* **BH-SEP (Safe Evolution Protocol):** Define como a IA deve evoluir software existente com segurança. O protocolo estabelece inspeção antes de alteração (*Inspect First*), preservação do código funcional (*Preserve Everything*), alterações mínimas (*Minimal Diff*) e validação incremental.

* **BH-SDP (Snapshot & Delivery Protocol):** Define mecanismos para preservação de estado e continuidade entre sessões. O protocolo transforma decisões, contratos, arquivos envolvidos e próximos passos em um artefato estruturado (*Snapshot*) capaz de transportar contexto de forma segura.

---

## 🔄 O Fluxo de Trabalho

### O Modelo Tradicional (Caminho para Regressões)

`[Prompt]` ──> `[Reconstrução Mental da IA]` ──> `[Reescrita de Código Existente]` ──> `[Bug / Regressão]`

### O Modelo Surgical DevOps (Evolução Segura e Persistente)

`[Código Existente (Verdade)]` ──> `[Inspeção Completa]` ──> `[Diff Mínimo]` ──> `[Validação]` ──> `[Snapshot de Estado]` ──> `[Próximo Passo Seguro]`

---

## 🏛️ Princípios Fundamentais do Ecossistema

1. **Inspect First (Inspecione Primeiro):**
O código existente representa a fonte de verdade. A IA não deve assumir contratos, rotas, dependências ou gerenciamento de estado sem inspeção adequada.

2. **Preserve Everything (Preserve Tudo):**
Código funcional deve ser preservado. Alterações fora do escopo solicitado aumentam risco e devem ser evitadas.

3. **Minimal Diff (Diferença Mínima):**
A evolução deve ocorrer através de intervenções pequenas, isoladas e rastreáveis, reduzindo impacto no histórico do projeto.

4. **Validate Immediately (Valide Imediatamente):**
Cada alteração deve ser seguida por validação antes da continuidade da próxima etapa.

5. **Advance Incrementally (Avance Incrementalmente):**
Problemas complexos devem ser divididos em passos menores e independentes.

6. **State Continuity (Continuidade de Estado):**
Decisões, contratos e pontos de parada relevantes devem ser preservados para permitir continuidade segura entre sessões.

---

## 🤖 Artefato: System Prompt Unificado para IA

Para iniciar uma sessão de desenvolvimento utilizando o ecossistema Surgical DevOps, copie e cole:

> Acesse os protocolos:
>
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md`
>
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`
>
> Adote de forma estrita, combinada e silenciosa as diretrizes do BH-SEP (Safe Evolution Protocol) e BH-SDP (Snapshot & Delivery Protocol).
>
> Opere como um Engenheiro de Software Sênior especializado no ecossistema do projeto.
>
> Antes de qualquer alteração, inspecione o contexto existente. Preserve código funcional, aplique mudanças mínimas e valide cada etapa.
>
> Caso exista um Snapshot de sessão anterior, utilize-o para recuperar o estado atual.
>
> Após compreender os protocolos e o contexto inicial, confirme respondendo:
>
> **"BH-SEP E BH-SDP ATIVADOS 🚀"**
>
> Em seguida, solicite o arquivo ou contexto que deve ser inspecionado primeiro.

---

## 📚 Documentação

Protocolos principais:

- [BH-SEP — Safe Evolution Protocol](./protocols/BH-SEP.md)
- [BH-SDP — Snapshot & Delivery Protocol](./protocols/BH-SDP.md)
- [Guia de Aplicabilidade](./protocols/APPLICABILITY.md)

Versão em inglês:

- [README_EN.md](./README_EN.md)

---

## 🌎 Origem

O Surgical DevOps nasceu dentro do ecossistema BônusHora, mas seus princípios são independentes de linguagem, framework ou arquitetura.

Pode ser aplicado em:

- aplicações mobile;
- aplicações web;
- sistemas backend;
- infraestrutura como código;
- projetos desenvolvidos com assistência de IA.

---

## 💡 Visão

O Surgical DevOps não substitui julgamento de engenharia.

Ele estabelece um modelo disciplinado onde decisões humanas permanecem soberanas e a execução assistida por IA permanece alinhada, rastreável e segura.
