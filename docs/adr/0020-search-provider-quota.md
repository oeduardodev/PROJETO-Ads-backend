# ADR 0020 — escopo e ativação da quota de busca externa

- Estado: ACEITO pelo usuário no passo 036.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.1, 7.2 e 15.3; roteiro 036; ADR 0004.

## Contexto

O roteiro exige uma interface de provedor, consultas `site:domínio`, quota diária e fallback quando a API falhar, sem scraping de buscadores. A arquitetura pede quota controlada e registra buscas como custo variável, mas não define limite numérico, escopo da quota nem comportamento quando não há provedor configurado. O usuário determinou anteriormente que chaves de busca só sejam exigidas quando conectores forem ativados.

## Alternativas

1. **Por host exato, configurável e desativada por padrão (recomendado):** quota diária UTC por host allowlisted, persistida no Redis; `SEARCH_DAILY_QUOTA_PER_HOST=0` desativa consultas externas até configuração explícita. Uma tentativa ao provedor consome quota mesmo se a API falhar; o fallback usa apenas fontes HTML/RSS/sitemap já cadastradas.
2. **Quota global diária:** limite UTC único compartilhado por todos os hosts. É simples, mas uma instituição pode consumir o orçamento das demais.
3. **Quota por fonte:** limite separado para cada source ID. Permite controlar fontes individualmente, mas pode multiplicar o gasto para o mesmo host.

## Decisão

Quota diária por host DNS exato, em UTC, persistida atomicamente no Redis e configurável por `SEARCH_DAILY_QUOTA_PER_HOST`. O padrão é zero (busca externa desativada). Uma tentativa admitida consome quota mesmo quando o provedor falha. Quando o provedor estiver ausente, desativado, sem quota ou indisponível, delegar ao fallback das estratégias HTML/RSS/sitemap cadastradas. Chaves de provedor só serão validadas quando uma implementação de conector for ativada.

Nenhum provedor real é configurado ou chamado nesta etapa; os testes usam somente provider mockado.

## Consequências

- Limites isolam hosts institucionais e a virada de quota ocorre à meia-noite UTC.
- Uma falha do Redis fecha a busca externa e encaminha ao fallback, sem chamada paga não contabilizada.
- `SEARCH_DAILY_QUOTA_PER_HOST` aceita somente inteiro seguro não negativo; zero permanece seguro por padrão.
- A interface não autoriza fonte, domínio ou conteúdo: validam-se host autorizado exato e URL HTTPS dos resultados, enquanto revisão de fonte e publicação seguem os gates existentes.
