# Extensão BH-CONTAINMENT para BH-SEP v2.3 + BH-SDP v2.3

## Escopo normativo

Esta extensão é aplicada em conjunto com os RAW normativos
[`BH-SEP.md`](./BH-SEP.md) e [`BH-SDP.md`](./BH-SDP.md). Os RAW históricos e
as cópias derivadas permanecem byte a byte inalterados. Carregar apenas um RAW
legado ou apenas a composição BH-SEP/BH-SDP não carrega esta extensão.

## Regras de contenção

1. Ações protegidas só podem começar depois que o loader do hospedeiro validar
   versão, caminho e SHA-256 de todas as partes do perfil ativo contra âncoras
   incorporadas ao runtime confiável.
2. O perfil de contenção não herda autorização de snapshot, manifesto, sessão
   anterior ou perfil legado. Componente ausente, alterado, incompatível ou
   inválido bloqueia a operação antes do lançamento.
3. Todo transporte externo deve fixar destino, operações, métodos, caminhos,
   limites e cabeçalhos. Um destino fixo não autoriza operações arbitrárias.
   Canais opacos, inclusive WebSocket sem parser qualificado, são recusados
   antes de qualquer byte de aplicação alcançar o upstream.
4. Credenciais privilegiadas permanecem no hospedeiro. O sandbox pode receber
   somente uma identidade não privilegiada e específica da sessão, validada
   pelo broker, que injeta a autenticação exclusivamente no destino fixado.
   Modos sem mediação comprovada ficam bloqueados, sem fallback permissivo.
5. Inspeção de conteúdo é heurística e delimitada; ausência de correspondência
   não certifica ausência universal de segredo. Envio exige também uma fonte
   explicitamente autorizada por política de saída mantida fora da escrita do
   agente. Fonte desconhecida ou não autorizada bloqueia a saída.
6. Recusa segura, isolamento nativo e funcionalidade do provider são dimensões
   independentes. Bloquear um canal inseguro não demonstra operação funcional.
7. O perfil não concede autoridade operacional, de mutação, publicação,
   credencial ou ampliação de escopo, e não afirma conter toda IA presente ou
   futura.

## Identificador

`BH-SEP-v2.3+BH-SDP-v2.3+BH-CONTAINMENT-v1`
