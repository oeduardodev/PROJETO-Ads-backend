# ADR 0041: renderizacao publica e metadados SEO

- Estado: aceito para o comportamento provisório, por decisão do usuário.
- Passo: 074.
- Data: 2026-11-11.
- Referências: arquitetura §§ 9.1, 9.3 e ADR-005; roteiro passo 074.

## Contexto

O roteiro pede comparar SSR/SSG e CSR no provedor real, definir `title`, `description`, `canonical` e sitemap de páginas publicadas. Os repositórios só configuram GitHub como remoto de código. Não há provedor de hospedagem, domínio público, URL oficial em `publicSiteUrl` nem API de produção configurada. O catálogo também está desativado no ambiente de produção do frontend. O identificador `docs/adr/0004-rendering.md` citado no roteiro conflita com o ADR 0004 já aceito para exigência de segredos.

## Alternativas

1. Escolher um hosting e domínio por suposição, implementar SSR/SSG e publicar URLs sem configuração oficial.
2. Manter CSR e metadados públicos no cliente até que provedor, domínio e fonte de processos publicados sejam definidos; então executar o comparativo no ambiente real.

## Decisão

O usuário escolheu a alternativa 2. Não adicionar dependência SSR nem escolher provedor. Definir títulos e descrições por rota. Rotas administrativas e detalhes sem confirmação pública ficam `noindex`; um detalhe só se torna indexável depois que `GET /processes/:id` retorna o processo público. Gerar canonical somente quando `publicSiteUrl` contém uma origem HTTPS válida; remover parâmetros de busca do canonical e não emitir canonical para páginas `noindex`. Metadados Open Graph acompanham título e descrição.

Não criar sitemap até existir domínio público oficial e mecanismo que liste apenas processos publicados. A ausência de sitemap neste estágio é deliberada; não substituir domínio ou conteúdo por valores fictícios.

## Pendências e consequências

- Comparar CSR com SSR/SSG no provedor real quando a hospedagem for escolhida; revisar suporte a renderização das rotas públicas, runtime Angular e acesso à API.
- Configurar domínio oficial em `publicSiteUrl` antes de emitir canonicals.
- Definir geração e atualização do sitemap baseada exclusivamente em processos publicados.
- Crawler sem execução de JavaScript verá apenas o shell durante a fase CSR; metadados dinâmicos completos dependem de SSR/SSG ou pré-renderização após a decisão de hosting.
- O ADR foi numerado `0041` para preservar o ADR 0004 existente, apesar do caminho repetido no roteiro.
