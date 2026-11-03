# Migrations PostgreSQL

O schema Prisma em `apps/api/prisma/schema.prisma` e o SQL versionado em `apps/api/prisma/migrations/` são a referência para alterações do banco. A migration `20261103015429_baseline` é vazia por intenção: as tabelas de instituições e campi entram no passo 015. API e worker criam o client gerenciado, mas não aplicam migrations ao iniciar.

## Desenvolvimento local

Inicie o PostgreSQL local com o Compose descrito no [README](../../README.md). Configure `DATABASE_URL` no ambiente do processo, apontando para um banco **local**. A CLI Prisma 7 lê a URL de `apps/api/prisma.config.ts`; ela não importa automaticamente o `.env` da raiz. Na pasta do backend:

```powershell
corepack pnpm --filter @alem-do-sisu/api db:validate
corepack pnpm --filter @alem-do-sisu/api db:migrate:status
corepack pnpm --filter @alem-do-sisu/api db:migrate:deploy
```

Para criar uma alteração de schema, edite o arquivo Prisma, use `prisma migrate dev --name nome_descritivo --create-only` em um banco local descartável, revise o SQL gerado e só então aplique a migration localmente. Não use `db push`, `migrate reset` ou sincronização automática no startup para alterar bancos compartilhados.

## Recuperação de alterações sensíveis

Prisma Migrate não gera um comando `down` automático. Para uma alteração sensível, documente antes da execução a janela, o backup verificado, o plano de restauração ou a migration compensatória e a estratégia para preservar os dados. Prefira expansão compatível, migração de dados verificada e contração em etapa posterior. Se uma migration falhar, interrompa a aplicação; inspecione o SQL, o estado real e `_prisma_migrations` antes de qualquer reparo. `prisma migrate resolve` só cabe após uma correção manual comprovada e registrada, não como forma de ignorar falhas.

Esta documentação não autoriza migration em produção. Qualquer execução em produção exige autorização explícita, revisão do SQL e plano de backup/recuperação específico.
