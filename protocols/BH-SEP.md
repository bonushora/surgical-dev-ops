# BH-SEP v2.2 — Safe Evolution Protocol

## 🎯 Objetivo
Garantir modificações cirúrgicas e previsíveis em código-fonte, minimizando regressões e preservando a integridade dos sistemas.

## 🏛️ Diretrizes Fundamentais
1. **Inspect First (Central da Verdade):**
   Nenhuma alteração de código deve ser feita sem declaração prévia de linhas lidas, causa raiz, hipótese e estimativa de diff (máximo 3 linhas).
   
2. **Focus Window (Disjuntor de Arquivos Grandes):**
   Arquivos com mais de 300 linhas não devem ser reescritos por inteiro. A IA deve solicitar o foco no intervalo de linhas específico (ex: `cat -n` ou `sed -n '50,100p'`).

3. **Modo Dual (Patch vs. Refactor):**
   - **Modo Patch (Padrão):** Modificações pontuais preservando código adjacente.
   - **Modo Refactor:** Autorizado explicitamente para reestruturações arquiteturais completas.

4. **Pré-Condição Red-to-Green:**
   A suíte de testes deve ser validada antes de iniciar uma refatoração para garantir que falhas existentes não sejam falsamente atribuídas às novas alterações.
