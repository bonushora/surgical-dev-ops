# 🎯 Guia de Aplicabilidade e Casos de Uso — BH-SEP

O protocolo **BH-SEP (ou a filosofia Truth First)** é agnóstico. Embora tenha nascido no ecossistema Flutter com o projeto BônusHora, as dores que ele cura são universais no desenvolvimento de software moderno assistido por IA.

Qualquer desenvolvedor pode aplicar este protocolo exatamente nas seguintes situações e aplicações:

---

## 🎯 Em quais situações aplicar?

* **Manutenção de Sistemas Legados ou em Produção:** Situações onde o código já está rodando e o risco de quebrar regras de negócio ocultas é altíssimo. A IA não pode "chutar" a arquitetura; ela precisa ler a verdade primeiro.
* **Refatorações de Arquivos Complexos:** Quando um arquivo gerencia estados complexos, árvores de componentes muito aninhadas (como Flutter ou React) ou conexões diretas com banco de dados. O princípio do **Minimal Diff** impede que a IA destrua lógicas paralelas.
* **Onboarding de Novos Desenvolvedores (ou Novas IAs) no Projeto:** Quando um programador entra em um projeto existente ou quando você abre um chat do zero, o protocolo serve como a barreira de contexto para que ninguém comece a sugerir alterações às cegas.
* **Correção de Bugs Críticos (Hotfixes):** Cenários de pressão onde o desenvolvedor precisa de uma intervenção cirúrgica rápida sem o risco de gerar efeitos colaterais ou regressões em outras partes do sistema.

---

## 💻 Para quais aplicações e ecossistemas?

O protocolo se encaixa perfeitamente em qualquer stack de tecnologia, com destaque para:

* **Aplicações Mobile (Flutter, React Native, Swift, Kotlin):** Onde o fluxo de navegação, ciclo de vida de telas e injeção de dependências mudam drasticamente entre arquivos.
* **Aplicações Web Single Page (React, Vue, Angular, Next.js):** Sistemas que possuem muitos subcomponentes compartilhando o mesmo estado global. O princípio do **Preserve Everything** garante que a IA não quebre os contratos desses componentes adjacentes.
* **Desenvolvimento de APIs e Back-end (Node.js, Python/FastAPI, Go, Java):** Onde contratos de rotas, middlewares, payloads de requisições e segurança não podem ser alterados ou "reinventados" pela IA durante a criação de um novo endpoint.
* **Projetos de Infraestrutura como Código (Terraform, Ansible, Dockerfiles):** Onde uma única linha alterada incorretamente pela IA pode derrubar um ambiente inteiro ou expor portas de segurança.

---

> 💡 **Resumo da Ópera:** O BH-SEP se aplica a qualquer situação onde o custo de corrigir uma alucinação da IA seja maior do que o tempo gasto guiando-a com precisão. Ele transforma a IA de uma geradora de códigos genéricos em um braço direito cirúrgico de engenharia.
