# Backup e restauração de PostgreSQL

## Escopo

Use este procedimento em banco de teste dedicado ou staging autorizado. Ele não concede autorização para acessar, restaurar ou migrar produção. Backups devem ficar fora do Git e em storage privado com criptografia, controle de acesso e retenção definidos. O storage de snapshots de editais segue bloqueado pelo ADR 0008; backup do banco não muda essa política.

## Criar e verificar backup lógico

Configure `TEST_DATABASE_URL` para PostgreSQL local dedicado, com nome terminado em `_test` ou `_e2e`, e `PGPASSWORD` no ambiente. Nunca inclua senha no arquivo de backup, shell history, log ou repositório.

```powershell
$backupPath = Join-Path $env:TEMP 'alem-do-sisu-backup.dump'
pg_dump --format=custom --no-owner --file=$backupPath $env:TEST_DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou' }
Get-FileHash -Algorithm SHA256 $backupPath
pg_restore --list $backupPath
```

Registre fora do Git: ambiente, versão do PostgreSQL cliente/servidor, horário UTC, tamanho, checksum SHA-256, migrations aplicadas, responsável e prazo de retenção. Se o backup contiver apenas dados sintéticos, identifique isso no registro.

## Restaurar em banco isolado

Crie um banco novo com sufixo `_test`; nunca use `--clean` contra banco compartilhado. Use credencial local com permissão de criação e remova apenas o banco descartável que acabou de criar.

```powershell
createdb --host=127.0.0.1 --port=5434 --username=$env:PGUSER alem_restore_test
pg_restore --no-owner --dbname=$env:RESTORE_DATABASE_URL $backupPath
if ($LASTEXITCODE -ne 0) { throw 'pg_restore falhou' }
```

Compare o inventário `_prisma_migrations`, constraints e consultas críticas entre origem e restore. Para documentos, compare a contagem e os valores ordenados de `documents.sha256` e `document_blobs.sha256`; diferenças impedem a aprovação do restore. Valide ainda readiness e uma consulta de leitura da aplicação. Descarte apenas o banco restore descartável após registrar a evidência.

## Evidência de ensaio local

Em 2026-11-12, PostgreSQL 17.7 descartável via Docker/WSL foi copiado com `pg_dump` 18 e restaurado em `alem_restore_test`. O arquivo custom-format passou `pg_restore --list`; SHA-256 do arquivo: `43e7256d9f601ef439cd07a21c21d3f0f8597ad175f23c865c1faab3aef8d2ae`. Origem e restore continham 16 migrations concluídas, um documento e um blob sintéticos, com o mesmo hash `17a403a6fd00d9944c0b71633fac55bcee6095376365d92c27bb662855f10121`. O banco restore é descartável e não representa staging ou produção.

## Antes de migration persistente

Siga também [migrations.md](migrations.md): revisar schema/SQL, fazer e validar backup, ensaiar restore, acordar janela/rollback e executar migration manualmente com autorização para o ambiente. API e worker nunca aplicam DDL ao iniciar. Em staging, repetir a restauração e comparar hashes antes de aprovar qualquer migration crítica.

