# ADR 0005 — ORM e migrations PostgreSQL

- Estado: ACEITO; decisão explícita do usuário no passo 014.
- Data: 2026-11-02 (America/Sao_Paulo).
- Referências: arquitetura §§ 1, 5, 6 e 7.1; roteiro 014.

## Contexto

A arquitetura pede um spike entre Prisma e TypeORM antes de escolher o ORM. O roteiro sugere Prisma como padrão, mas a migration inicial deve seguir a escolha documentada. PostgreSQL é a fonte persistente; migrations devem ser versionadas e executadas explicitamente, sem sincronização destrutiva no boot.

## Spike local

O spike ocorreu em uma cópia temporária do backend, com Node 24.15.0, TypeScript 6.0.3, NestJS 12.3.2 e PostgreSQL 17.7 local. Nenhuma mudança de schema de produção ou migração no banco de desenvolvimento principal foi feita.

| Critério | Prisma 7.10.1 | TypeORM 1.1.2 |
| --- | --- | --- |
| Compatibilidade ESM/Node/Nest | Schema validado; cliente gerado compilou com `tsc` e conectou via `@prisma/adapter-pg`; `SELECT 1` passou. | `DataSource` ESM com `synchronize: false` e `migrationsRun: false` conectou e executou `SELECT 1`. `@nestjs/typeorm` 12.0.2 declara suporte a Nest 12 e TypeORM 1.x. |
| Migrations | CLI gerou SQL revisável a partir de schema declarativo; requer `prisma.config.ts` com datasource e geração explícita do cliente. | Migrations em classes TS/JS; a CLI exige DataSource separado e execução de JS compilado ou loader ESM. |
| Regra operacional | `migrate dev` apenas em banco de desenvolvimento; produção exigiria comando controlado e revisão do SQL. | `synchronize` e `migrationsRun` desativados; execução explícita da CLI. |

Fontes primárias: [Prisma 7 com PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [CLI de migrations Prisma 7](https://www.prisma.io/docs/cli/v7/migrate/dev), [migrations TypeORM](https://typeorm.io/docs/migrations/setup/) e [TypeORM no NestJS](https://docs.nestjs.com/data/typeorm).

## Alternativas e decisão

1. **Prisma 7.10.1** — acompanha o padrão do roteiro, gera cliente tipado e SQL de migration revisável. Fixar CLI, cliente e adapter na mesma versão estável; não usar Prisma 8 enquanto estiver release candidate.
2. **TypeORM 1.1.2** — integração Nest direta e migrations explícitas, com mais convenções para entidade, DataSource e execução ESM.

Decisão: alternativa 1, Prisma 7.10.1. O usuário escolheu explicitamente esta opção após o spike. O schema declarativo e as migrations SQL versionadas serão a referência operacional. A aplicação não aplicará migrations ao iniciar.

## Consequências

Criar schema e migration inicial mínima no passo 014, gerenciar o client como provider Nest, validar em banco **local vazio** e documentar recuperação/rollback para mudanças sensíveis. Não executar migrations no startup da API/worker, em CI de PR ou em produção sem autorização explícita.

Como as entidades de instituição e campus pertencem ao passo 015, a baseline inicial é vazia e apenas inaugura o histórico de migrations. O client conecta sob demanda e encerra o pool no ciclo de vida do Nest; readiness de dependências fica no passo 019.
