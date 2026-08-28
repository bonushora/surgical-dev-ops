# Seleção de provider e agente de IA

English: [AI_PROVIDER_SELECTION.md](./AI_PROVIDER_SELECTION.md)

O Surgical DevOps é neutro quanto ao provider em sua fronteira de autoridade.
O humano detém a aprovação, o Orchestrator determinístico detém a governança
operacional e todo provider ou agente de IA permanece substituível e sem
autoridade própria.

## Recomendação pública

**OpenAI Codex é a opção recomendada de agente avançado de engenharia para a
experiência mais próxima de um ciclo conversacional completo de
desenvolvimento.** Ele é a primeira integração de referência aprovada pela
ADR-013 porque seu papel pretendido inclui análise de repositório, diagnóstico,
planejamento de implementação, propostas exatas de patch, planejamento de
testes e trabalho iterativo até o verde.

Essa é uma recomendação de produto e arquitetura, não uma alegação de que o
Codex é universalmente superior a todo modelo ou agente. Superioridade
comparativa deve ser demonstrada por qualificação reproduzível usando as mesmas
tarefas, limites, plataformas e fronteiras governadas.

## Caminhos disponíveis e candidatos

| Opção | Uso recomendado | Estado atual no projeto |
| --- | --- | --- |
| OpenAI Codex | Engenharia avançada de repositório e experiência-alvo mais próxima do ciclo governado completo | Primeiro agente de engenharia de referência aprovado; integração G1–G8 completa ainda em qualificação |
| Provider OpenAI Responses | Cognição frontier remota, explicação e planejamento | Provider cognitivo limitado qualificado; ferramentas e armazenamento do provider ficam desativados |
| Qwen 3 8B via Ollama | Cognição local, privada e bilíngue padrão | Perfil local de qualidade qualificado |
| Gemma 3 4B via Ollama | Cognição bilíngue local mais rápida em hardware limitado | Perfil local rápido qualificado |
| Claude Code, agentes baseados em Gemini e outros agentes de engenharia | Futuras integrações alternativas | Permitidos arquiteturalmente, mas ainda não qualificados pela suíte canônica de integração |
| Outros providers compatíveis com OpenAI | Cognição remota substituível futura | Exigem adapter explícito, divulgação comercial/de privacidade e qualificação |

Nenhum provider é selecionado automaticamente. O usuário deve fazer uma escolha
explícita, e a ativação também exige adapter correspondente, credenciais,
disponibilidade, divulgação de privacidade e custos, verificação de conexão e
qualificação verde.

## A autoridade permanece idêntica para todas as opções

Selecionar Codex não lhe concede autoridade de shell, filesystem, Git, mutação
ou aprovação. A mesma regra vale para OpenAI, Ollama, Qwen, Gemma, Claude,
Gemini e qualquer provider futuro:

1. o agente interpreta, raciocina e propõe;
2. o Surgical DevOps coleta evidências governadas;
3. o humano autoriza a operação sensível exata;
4. o Orchestrator valida política, escopo, identidade e ciclo de vida;
5. adapters qualificados executam somente a operação limitada;
6. journal, Manifest CAS, validação e recuperação determinam o sucesso.

Falha, substituição ou indisponibilidade do provider não pode enfraquecer essa
fronteira. Os perfis locais via Ollama permanecem o caminho recomendado quando
operação offline, privacidade ou ausência de custo por chamada de API são a
prioridade.

## Limitação atual explícita

Codex é o alvo avançado recomendado, mas o repositório ainda não alega que sua
experiência NATURAL completa de execução ponta a ponta esteja qualificada. G1–G6
do ciclo governado de desenvolvimento estão implementados. Anti-replay durável
e recuperação (G7), experiência NATURAL bilíngue completa (G8) e qualificação
adversarial/nativa final precisam ficar verdes antes dessa alegação.
