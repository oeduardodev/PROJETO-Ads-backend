# ADR 0000 — Repositórios separados para frontend e backend

- Estado: aceito por decisão do usuário em 2026-11-02
- Referências: arquitetura §§ 7.1, 11; roteiro §§ 1, 2, 6.1 e passo 006

## Contexto

A arquitetura propõe um monorepo lógico com API NestJS, worker e Angular. O roteiro sugere um único workspace pnpm. O projeto recebeu dois repositórios GitHub vazios, `PROJETO-Ads-frontend` e `PROJETO-Ads-backend`, e o usuário escolheu mantê-los separados. A separação física não altera a divisão de responsabilidades da arquitetura.

## Decisão

- O backend mantém a API, o worker, as migrations, o domínio, os contratos REST/OpenAPI, a documentação de arquitetura e `docs/implementation/PROGRESS.md`.
- O frontend mantém Angular, seus testes, assets e documentação específica de interface. A imagem `style-reference.png` fornecida no workspace orienta as etapas visuais.
- Cada repositório terá seu próprio `package.json`, lockfile pnpm e CI. O passo 006 será adaptado para preparar convenções e workspaces adequados a cada repositório, sem criar um terceiro repositório.
- Cada passo produz um commit Conventional Commits no repositório pertinente, após validação verde. Se um passo futuro exigir alteração coordenada nos dois repositórios, o progresso registrará os dois commits, seus SHAs, a ordem e a compatibilidade entre versões.
- O OpenAPI versionado do backend será o contrato de integração. O frontend não copiará DTOs internos de revisão; a geração do cliente e a estratégia de compatibilidade serão implementadas no passo 029.
- Nenhum commit local implica push. Push, deploy e migração em produção dependem de autorização explícita.

## Alternativa considerada

Um único repositório Git na raiz corresponderia literalmente ao workspace pnpm sugerido e permitiria um commit atômico para alterações em ambos os aplicativos. Não foi adotado porque o usuário escolheu manter os dois repositórios fornecidos.

## Consequências

A documentação compartilhada tem uma fonte canônica no backend. Integrações que cruzem os repositórios exigirão contratos versionados e validação de compatibilidade. O plano operacional deve ser lido com essa adaptação explícita; as responsabilidades da API, worker, Angular, PostgreSQL e Redis permanecem as da arquitetura.
