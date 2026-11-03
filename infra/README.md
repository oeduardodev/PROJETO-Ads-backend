# Infraestrutura local — passo 009

Este Compose sobe apenas PostgreSQL 17.7 e Redis 7.4.12 para desenvolvimento. Não há migrations, deploy ou serviços de produção. As imagens oficiais foram fixadas por versão. PostgreSQL 17 usa o volume em `/var/lib/postgresql/data`; Redis grava AOF em `/data`. Os serviços publicam somente em `127.0.0.1` (portas 5433 e 6380 por padrão).

Crie `.env` na raiz do backend com `POSTGRES_PASSWORD=<senha-local>`; o arquivo é ignorado pelo Git. Execute a partir da raiz do backend:

```text
docker compose --env-file .env -f infra/compose.dev.yml config --quiet
docker compose --env-file .env -f infra/compose.dev.yml up -d --wait
docker compose --env-file .env -f infra/compose.dev.yml ps
docker compose --env-file .env -f infra/compose.dev.yml restart
docker compose --env-file .env -f infra/compose.dev.yml stop
```

No Windows deste workspace, o Docker Engine e o plugin Compose estão no Ubuntu 24.04 do WSL 2. Execute os comandos no shell Ubuntu, no diretório do backend montado em `/mnt/c/`. Não é necessário aceitar a licença do Docker Desktop. Quem usar Docker Desktop pode executar os mesmos comandos no PowerShell.

Para conexões locais da API/worker que rodam no Windows, usar `127.0.0.1:5433` para PostgreSQL e `127.0.0.1:6380` para Redis; de dentro de outro container Compose, usar `postgres:5432` e `redis:6379`. A validação de `DATABASE_URL`/`REDIS_URL` e o exemplo de ambiente entram no passo 010. Nunca colocar a senha no bundle Angular.

Os volumes nomeados `alem-do-sisu-dev_postgres_data` e `alem-do-sisu-dev_redis_data` sobrevivem a `restart`, `stop` e `up`. Evite `down -v`: ele **remove** os dados locais. O teste do passo 009 grava valores descartáveis de diagnóstico e confirma que continuam após reiniciar os serviços, sem migrar schema.
