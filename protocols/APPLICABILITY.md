# 🎯 BH-AP — Guia de Aplicabilidade e Limites Operacionais (v2.1)

Este documento estabelece os **critérios de sucesso, métricas de aferição e casos de NÃO-aplicação** do ecossistema Surgical DevOps.

---

## 🛑 Casos de NÃO-Aplicação (Onde o Protocolo FALHA)

O Surgical DevOps **NÃO deve ser utilizado** para:

1. **Prototipagem do Zero (Greenfield Exploratório):**
   - *Por quê:* Tentar impor Modo PATCH ou Inspeção Declarativa em um repositório vazio gera burocracia sem valor. Greenfield exige liberdade total de geração.
2. **Sistemas Sem Suíte de Testes Automatizada:**
   - *Por quê:* Sem `pytest` ou `npm test`, a "Ancoragem Física" do BH-SDP reduz-se a auto-relato do modelo. O protocolo exige um executor externo de testes para garantir determinismo.
3. **Tarefas de Escrita Criativa, Documentação Pura ou Design:**
   - *Por quê:* O protocolo foi projetado estritamente para alteração e evolução defensiva de código-fonte.

---

## 📊 Métricas de Aferição e Critérios de Sucesso

| Métrica | Meta (Alvo) | Como Medir |
| :--- | :--- | :--- |
| **Taxa de Regressão em Código Legado** | `< 5%` das alterações | Testes que quebraram após PR assistido por IA. |
| **Tamanho do Diff por Intervenção** | `< 50 linhas` (Modo PATCH) | `git diff --shortstat` por commit de evolução. |
| **Adesão à Ancoragem Física** | `100%` nos Snapshots | Presença de `git_commit_hash` real e status de testes. |
| **Aderência aos Schemas do Server** | `0` exceções de Schema em produção | Rejeição `HTTP 422` pelo Pydantic/FastAPI no Middleware. |

---

## 🛡️ Onde o Determinismo Reside: Disjuntores vs Prompts

> **AVISO DE ARQUITETURA:**
> Nenhuma instrução em linguagem natural (prompt) é 100% determinística. O determinismo real do Surgical DevOps **exige o Harness do Servidor (BH-SMC)**:
> - O **Prompt** força a LLM a declarar intenções e limitar a área de impacto.
> - O **Pydantic/FastAPI** rejeita respostas que violem o Schema JSON.
> - O **Pytest** valida se a lógica do código funciona de fato.
