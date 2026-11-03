# Migrations, backup e recuperação

## Teste em ambiente descartável

O job `database` do CI cria um serviço PostgreSQL efêmero com schema vazio, executa todas as migrations versionadas, confere `migrate status`, semeia o registro histórico revisado e roda a integração. A limpeza é o descarte do serviço ao fim do job. Localmente, use apenas um banco de teste dedicado e `TEST_DATABASE_URL` apontando para loopback; não use `migrate reset` num banco compartilhado. As constraints e relações restritivas são verificadas em `test/integration/db/invariants.test.mjs`.

## Preparação de qualquer migration em ambiente persistente

1. Revisar diff do schema, SQL de migration, compatibilidade com dados atuais e índices. Testar em cópia isolada antes de agendar janela.
2. Produzir backup lógico e registrar versão do PostgreSQL, horário, tamanho e checksum SHA-256. Conferir a listagem com `pg_restore --list` e restaurar em banco isolado; comparar contagens e consultas críticas. Guardar o arquivo em armazenamento privado com retenção definida.
3. Definir responsável, janela, observabilidade, critério de abortar e plano de retorno. Para alteração destrutiva, preparar migration compensatória e estratégia de preservação dos dados.
4. Aplicar somente com autorização explícita para o ambiente. Depois, conferir `_prisma_migrations`, `migrate status`, constraints e consultas. Não iniciar API/worker com DDL automático.

Exemplo para **banco local descartável**, com credenciais fornecidas por variável de ambiente, nunca no comando ou no Git:

```sh
pg_dump --format=custom --no-owner --file=backup-local.dump "$TEST_DATABASE_URL"
pg_restore --list backup-local.dump
```

Se uma migration falhar, interromper a sequência e preservar logs/backup. Conferir DDL efetivamente aplicado, dados e `_prisma_migrations`; corrigir com migration aditiva ou restauração ensaiada. `prisma migrate resolve` só após correção manual comprovada, com registro do motivo. Este procedimento não concede autorização para migrar ou restaurar produção.
