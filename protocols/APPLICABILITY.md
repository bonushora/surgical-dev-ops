# 🎯 Guia de Aplicabilidade e Casos de Uso — Ecossistema BH

Os protocolos **BH-SEP (Safe Evolution Protocol)** e **BH-SDP (Snapshot & Delivery Protocol)** formam um ecossistema agnóstico de engenharia criado para governar e padronizar o comportamento de Grandes Modelos de Linguagem (LLMs) durante o ciclo de desenvolvimento de software assistido por Inteligência Artificial.

Embora tenham surgido dentro do ecossistema BônusHora, seus princípios resolvem problemas universais da engenharia moderna assistida por IA:

- alucinação causada por falta de contexto;
- suposição indevida sobre arquiteturas existentes;
- reescritas desnecessárias de código funcional;
- geração de regressões;
- perda de conhecimento estratégico durante sessões longas;
- degradação de contexto entre diferentes sessões de desenvolvimento.

Eles atuam de forma complementar:

- **BH-SEP define como a IA deve analisar e modificar software com segurança.**
- **BH-SDP define como a IA deve preservar, transportar e recuperar o estado estratégico do projeto.**

O resultado é um modelo operacional controlado:


Código Existente (Verdade)
↓
Inspeção Completa
↓
Alteração Mínima
↓
Validação Imediata
↓
Snapshot de Estado
↓
Próximo Passo Seguro


---

# 🎯 Quando aplicar?

# 🛡️ BH-SEP — Safe Evolution Protocol

## Manutenção de Sistemas Legados ou em Produção

Aplicável quando o software já possui usuários, regras de negócio ocultas, decisões arquiteturais históricas ou dependências críticas.

Nessas situações, a IA não deve reconstruir mentalmente o sistema.

O protocolo exige:

- inspeção completa antes de qualquer alteração;
- preservação do comportamento existente;
- respeito aos contratos atuais;
- mudanças isoladas;
- validação após cada intervenção.

O código existente representa o **Centro da Verdade (Truth Center)**.

---

## Refatorações Complexas

Arquivos extensos, gerenciamento de estado, árvores de componentes, injeção de dependências e integrações externas possuem alto risco de regressão.

O BH-SEP impede:

- reorganizações não solicitadas;
- melhorias cosméticas fora do escopo;
- remoção acidental de lógica existente;
- alterações arquiteturais não homologadas.

A IA deve modificar somente o menor escopo necessário.

---

## Entrada de Novos Desenvolvedores ou Novas Sessões de IA

Quando uma nova pessoa ou uma nova sessão de IA entra em um projeto existente, o protocolo funciona como uma camada de segurança contextual.

Antes de sugerir mudanças:

- o projeto deve ser inspecionado;
- os contratos devem ser identificados;
- as decisões existentes devem ser preservadas.

Nenhuma alteração deve nascer de suposição.

---

## Correções Críticas e Hotfixes

Em situações de urgência, velocidade não pode substituir precisão.

O BH-SEP permite intervenções rápidas mantendo:

- baixo impacto;
- rastreabilidade;
- menor risco de efeitos colaterais.

---

# 💾 BH-SDP — Snapshot & Delivery Protocol

## Prevenção de Degradação de Contexto

Sessões longas acumulam:

- códigos;
- decisões;
- restrições;
- hipóteses temporárias;
- contratos arquiteturais.

O BH-SDP cria um artefato estruturado capaz de transportar o estado atual para uma nova sessão.

---

## Proteção de Definições Críticas

Quando uma decisão importante é estabelecida, como:

- regra de negócio;
- arquitetura;
- modelo de dados;
- contrato de API;
- fluxo operacional;

o estado pode ser consolidado em um Snapshot.

Esse mecanismo transforma conhecimento temporário da conversa em documentação operacional.

---

## Pontos de Parada e Continuidade

Quando ocorre:

- pausa no desenvolvimento;
- mudança de arquivo;
- troca de sessão;
- transferência para outro desenvolvedor;

o Snapshot funciona como artefato de continuidade.

Ele contém:

- objetivo atual;
- arquivos envolvidos;
- decisões tomadas;
- restrições;
- próximo passo.

---

## Detecção de Conflitos

Caso uma nova solicitação contradiga uma definição previamente estabelecida, o Snapshot permite identificar a divergência antes da implementação.

O conflito deve ser resolvido antes da alteração do código.

---

## Invocação Manual

O Snapshot pode ser solicitado diretamente através do comando:


[SNAPSHOT]


---

# 💻 Aplicações e Tecnologias Compatíveis

O Surgical DevOps é independente de linguagem ou stack tecnológica.

Pode ser aplicado em:

## Aplicações Mobile

Exemplos:

- Flutter;
- React Native;
- Swift;
- Kotlin.

Protege:

- fluxos de navegação;
- gerenciamento de estado;
- dependências;
- contratos de interface.

---

## Aplicações Web

Exemplos:

- React;
- Vue;
- Angular;
- Next.js.

Protege:

- componentes compartilhados;
- estados globais;
- integrações;
- arquitetura frontend.

---

## Sistemas Backend

Exemplos:

- Node.js;
- Python/FastAPI;
- Go;
- Java.

Protege:

- contratos de API;
- autenticação;
- modelos de dados;
- middlewares.

---

## Infraestrutura como Código

Exemplos:

- Terraform;
- Ansible;
- Docker.

Protege ambientes contra alterações incorretas capazes de causar impactos amplos.

---

# 💾 Fluxo de Transferência do Snapshot

## 1. Geração

A IA produz um artefato contendo:

- estado atual;
- decisões;
- restrições;
- próximos passos.

---

## 2. Armazenamento

O Snapshot pode ser salvo temporariamente em:


snapshot.txt


ou outro mecanismo de documentação.

---

## 3. Hidratação da Nova Sessão

Uma nova sessão recebe:

1. comando de ativação dos protocolos;
2. Snapshot anterior.

A nova IA recupera o contexto antes de executar qualquer alteração.

---

# 💡 Resumo

O acoplamento do **BH-SEP + BH-SDP** transforma a IA de uma simples geradora de código em um assistente de engenharia controlado.

Ele permite:

- evolução segura de sistemas complexos;
- preservação de conhecimento arquitetural;
- redução de regressões;
- continuidade entre sessões;
- colaboração previsível entre humanos e IA.

O Surgical DevOps não substitui julgamento de engenharia.

Ele cria um modelo disciplinado onde decisões humanas permanecem soberanas e a execução da IA permanece alinhada, rastreável e segura.
