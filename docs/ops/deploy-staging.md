# Preparar homologação

O deploy de homologação aguarda a escolha de provedor e domínio (ADR 0043). Este roteiro descreve os gates operacionais; ele não contém nomes de serviços, endpoints ou credenciais presumidos e não executa deploy.

Há um Compose local isolado em `infra/staging/compose.yml` para exercitar containers, migrations manuais e browser→API sem mocks em loopback. Consulte o README desse diretório. Ele não é o deploy de homologação externa descrito abaixo.

## Pré-requisitos

- Hosting compatível com Angular CSR, containers NestJS API e worker contínuo.
- Domínio de staging controlado pela equipe, TLS, DNS e origens CORS exatas.
- PostgreSQL e Redis isolados, backups automatizados com restore ensaiado.
- Storage privado e política de retenção aprovada por fonte antes de persistir snapshots oficiais (ADR 0008).
- Secrets fornecidos pelo vault do provedor; nunca gravados em Git, imagem ou bundle Angular.
- Imagens construídas de commits identificados e checks de CI verdes.

## Sequência controlada

1. Revisar o diff das migrations, compatibilidade com o schema anterior e plano de rollback; confirmar backup restaurável.
2. Executar migrations manualmente contra staging, usando credenciais restritas. O deploy da API/worker não aplica migrations automaticamente.
3. Iniciar API e worker separados; validar `/health`, `/ready`, CORS e observabilidade sem expor rotas internas.
4. Iniciar a web com `API_BASE_URL` e `PUBLIC_SITE_URL` correspondentes ao domínio aprovado; conferir navegação CSR e links oficiais publicados.
5. Rodar smoke/E2E no domínio de staging, incluindo aprovação humana controlada, invisibilidade de rascunhos, processo publicado pela API real, jornadas browser sem mocks e start/stop/rollback.
6. Registrar versões, resultados, backup/restore e pendências em `docs/implementation/PROGRESS.md`. A evidência local offline não substitui esta validação.

## Restrições

Não publicar edital, URL ou cadastro sem fonte oficial e revisão humana. Não carregar snapshots oficiais enquanto a revisão de licença/retenção estiver pendente. Este roteiro não autoriza deploy de produção nem migrations em produção; ambos requerem autorização explícita.

