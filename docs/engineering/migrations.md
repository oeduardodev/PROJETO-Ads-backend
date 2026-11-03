# Migrations PostgreSQL

O schema Prisma em `apps/api/prisma/schema.prisma` e o SQL versionado em `apps/api/prisma/migrations/` são a referência para alterações do banco. A migration `20261103015429_baseline` é vazia por intenção; `20261103015903_institutions_campuses` cria as tabelas do passo 015, com chave estrangeira, índices únicos e restrição de UF; `20261103152248_source_registry` cria a allowlist de hosts e as fontes em rascunho; `20261103153048_discovery_records` registra execuções, candidatos e observações; `20261103154133_document_snapshots` registra blobs por hash e versões por URL; `20261103160000_processes_offerings_windows` cria processos, ofertas, reservas, janelas e requisitos, com checks para vagas não negativas; `20261103163000_evidence_revisions_reviews` separa publicação de coleta e cria histórico imutável de evidências, retificações e decisões; `20261103170000_query_indexes_historical_seed` adiciona índices de filtros e trigramas, marcador histórico e bloqueio de publicação da demonstração; `20261103173000_campus_verification` adiciona revisão individual de campus; `20261103193000_process_verified_at` registra a data de verificação do processo e seu índice de busca publicada. API e worker criam o client gerenciado, mas não aplicam migrations ao iniciar.

## Desenvolvimento local

Inicie o PostgreSQL local com o Compose descrito no [README](../../README.md). Configure `DATABASE_URL` no ambiente do processo, apontando para um banco **local**. A CLI Prisma 7 lê a URL de `apps/api/prisma.config.ts`; ela não importa automaticamente o `.env` da raiz. Na pasta do backend:

```powershell
corepack pnpm --filter @alem-do-sisu/api db:validate
corepack pnpm --filter @alem-do-sisu/api db:migrate:status
corepack pnpm --filter @alem-do-sisu/api db:migrate:deploy
```

Após aplicar as migrations em um banco **local**, `node --env-file=.env apps/api/dist/database/seed.js` cria de forma idempotente UFPB, UFCG, UEPB e IFPB e um processo histórico de demonstração UFPB-12, quando o `DATABASE_URL` aponta para esse banco. O script recusa hosts fora do loopback. A seed institucional contém nomes, siglas, natureza pública e links oficiais; `verified_at` permanece nulo. O processo é `RASCUNHO`, `demo_historical=true` e não publicável por constraint; sua URL, prazo e classificação vêm do corpus revisado. Não se criam campus, ofertas ou snapshots. Para o teste de integração, defina `TEST_DATABASE_URL` para um banco local migrado e sem outras instituições, execute a seed e então `corepack pnpm test:integration`.

Para criar uma alteração de schema, edite o arquivo Prisma, use `prisma migrate dev --name nome_descritivo --create-only` em um banco local descartável, revise o SQL gerado e só então aplique a migration localmente. Não use `db push`, `migrate reset` ou sincronização automática no startup para alterar bancos compartilhados.

## Recuperação de alterações sensíveis

Prisma Migrate não gera um comando `down` automático. Para uma alteração sensível, documente antes da execução a janela, o backup verificado, o plano de restauração ou a migration compensatória e a estratégia para preservar os dados. Prefira expansão compatível, migração de dados verificada e contração em etapa posterior. Se uma migration falhar, interrompa a aplicação; inspecione o SQL, o estado real e `_prisma_migrations` antes de qualquer reparo. `prisma migrate resolve` só cabe após uma correção manual comprovada e registrada, não como forma de ignorar falhas.

Esta documentação não autoriza migration em produção. Qualquer execução em produção exige autorização explícita, revisão do SQL e plano de backup/recuperação específico.
