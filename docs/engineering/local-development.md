# Ambiente local

O [README da raiz](../../README.md) contém o caminho completo para reproduzir o ambiente. Esta página explica os endereços e os limites atuais.

| Processo | Origem | Endereço local | Persistência |
| --- | --- | --- | --- |
| PostgreSQL 17.7 | `infra/compose.dev.yml` | `127.0.0.1:5433` | volume `alem-do-sisu-dev_postgres_data` |
| Redis 7.4.12 | `infra/compose.dev.yml` | `127.0.0.1:6380` | volume `alem-do-sisu-dev_redis_data`, AOF |
| API NestJS | `apps/api/dist/main.js` | `http://127.0.0.1:3000/health` | client Prisma sob demanda; readiness de banco no passo 019 |
| Worker NestJS | `apps/api/dist/worker.js` | sem porta HTTP | ainda não executa jobs |
| Angular | `../frontend/apps/web` | `http://127.0.0.1:4200/` | shell estático local |

O Compose aceita `POSTGRES_PORT` e `REDIS_PORT` para alterar as portas locais. Se alterá-las, atualize `DATABASE_URL` e `REDIS_URL` em `.env`. API/worker leem variáveis do processo; `node --env-file=.env` carrega o arquivo local. `DATABASE_URL` com usuário, senha e banco, `REDIS_URL` e `CORS_ORIGINS` são obrigatórios conforme o processo. Erros de configuração identificam a variável sem imprimir o valor.

No WSL 2 do Windows deste workspace, o Docker Engine e o plugin Compose estão no Ubuntu 24.04. Se `docker compose` não estiver instalado em uma distribuição Ubuntu 24.04 nova, instalar os pacotes `docker.io` e `docker-compose-v2`, iniciar o serviço Docker e repetir `docker compose version`. O bind em `127.0.0.1` foi testado do Windows para as portas 5433 e 6380. Em outra máquina, confirme o encaminhamento de portas do WSL antes de iniciar a API.

`/health` só comprova que a API responde; a verificação de PostgreSQL/Redis no readiness entra no passo 019. O worker encerra após inicialização até que os jobs sejam criados. Os testes `test:e2e` atuais verificam subida e HTTP, enquanto o fluxo de navegador completo virá depois. A interface não contém edital vigente nem consome o corpus histórico como dados públicos.

Não há migration, seed ou reset automático. As [migrations Prisma e a seed do piloto](migrations.md) são executadas manualmente em banco local. O corpus e as fontes institucionais ficam em `docs/research/` para curadoria e testes, sujeitos às decisões de licença, retenção e revisão humana registradas no progresso.
