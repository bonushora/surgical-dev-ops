# Publicação npm qualificada

English: [NPM_PUBLICATION.md](./NPM_PUBLICATION.md)

O Surgical DevOps publica um único pacote para `NATURAL`, `ENGINEER` e `EXPERT`.
A publicação é intencionalmente indisponível em execuções comuns de branch e
pull request. Uma tag imutável `v*` inicia a matriz canônica Ubuntu, macOS e
Windows. O job `publish-npm` depende da matriz completa e não pode iniciar se
qualquer job nativo falhar.

A tag deve ser exatamente `v` mais a versão do pacote e deve identificar o
commit obtido no checkout. O ambiente npm deve usar o Trusted Publishing do npm
para este repositório e workflow do GitHub. O job solicita somente leitura do
conteúdo do repositório e o token de identidade OIDC necessário à proveniência
npm.

Reutilizar uma versão npm existente, contornar a matriz, publicar a partir de um
worktree local ou fornecer autoridade de publicação a um provider de IA está
fora do contrato qualificado.
