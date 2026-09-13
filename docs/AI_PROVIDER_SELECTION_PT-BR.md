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

Descoberta e ativação padrão automáticas são permitidas somente para um modelo
Ollama local qualificado: o endpoint deve ser o endpoint canônico de loopback, o
transporte local deve estar qualificado e o modelo permitido deve já estar
instalado no inventário verificado. Nenhum modelo é baixado automaticamente.
Providers externos, inclusive Codex, são somente opt-in explícito e nunca são
fallback automático. Uma seleção humana explícita nunca é substituída
silenciosamente. Nenhuma seleção de provider concede autoridade operacional nem
autoriza filesystem, shell, Git, mutação, rede externa ou qualquer outra operação.

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

`@openai/codex-sdk` é uma dependência npm opcional. Uma instalação básica
offline usa `--omit=optional`; `NATURAL`, `ENGINEER` e `EXPERT` permanecem
instalados e utilizáveis sem o SDK. Codex continua opt-in explícito e usa um
serviço cognitivo externo sujeito à conta/plano configurado. Se o SDK estiver
ausente, Codex é informado como indisponível ou com configuração necessária e
falha fechado: não é ativado, nenhum provider é substituído silenciosamente e
nada é baixado automaticamente. Uma instalação completa só pode resolver o SDK
por um mecanismo npm explicitamente autorizado pelo humano. Isso não é uma
alegação de que Codex esteja instalado ou qualificado.

A integração com o Codex SDK aplica essa fronteira fisicamente. O SDK recebe
somente o caminho virtual `/cognitive/workspace` e inicia um launcher gerado em
uma sessão efêmera restrita. Em hosts Linux qualificados, o Bubblewrap expõe
somente o executável Codex, bibliotecas indispensáveis e essa sessão cognitiva
vazia; repositório original, `.git`, diretórios pessoais, segredos do host,
escritas externas e rede genérica ficam fora do namespace. Conteúdo do repositório só
alcança o request cognitivo após aquisição pelo broker e qualificação de conteúdo
sensível. O launcher preserva stream JSONL e semântica de saída do SDK, e a
sessão é removida em reset, encerramento e falha.

Codex usa um subprocesso SDK local, mas sua cognição é um serviço externo. Em
hosts Linux qualificados, um relay nativo com ciclo de vida limitado à sessão
expõe um único endpoint loopback fixo dentro do namespace privado. Um broker
Unix-socket do Orchestrator, cego a credenciais, aceita somente os caminhos fixos
do protocolo do provider Codex e se conecta somente ao provider selecionado pela
configuração confiável de autenticação. Internet arbitrária, rede do host,
localhost e acesso de proxy permanecem negados. Ausência do broker, requests
malformados, permissões inválidas do endpoint e falha upstream permanecem
fail-closed, sem fallback para rede compartilhada.

Não existe fallback read-only. Se a contenção nativa estiver ausente ou ainda
não tiver qualificação física, o Codex permanece indisponível com
`CODEX_CONTAINMENT_UNAVAILABLE`. Bubblewrap no Linux está fisicamente
qualificado pelos testes atuais. Seatbelt no macOS e AppContainer no Windows
preservam suas fronteiras de adapters nativos, mas os launchers Codex com
streaming estão `NOT_EXECUTED` e indisponíveis até validação física nessas
plataformas.

## Limitação atual explícita

Codex é o alvo avançado recomendado, mas o repositório ainda não alega que sua
experiência NATURAL completa de execução ponta a ponta esteja qualificada. G1–G6
do ciclo governado de desenvolvimento estão implementados. Anti-replay durável
e recuperação (G7), experiência NATURAL bilíngue completa (G8) e qualificação
adversarial/nativa final precisam ficar verdes antes dessa alegação.
O executável Codex real dependente de rede não é exercitado pela suíte offline
de contenção; ela usa um executável local compatível com o protocolo para validar
isolamento de processo e streaming sem credenciais ou acesso à rede.
