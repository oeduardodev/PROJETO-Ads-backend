# ADR 0043 — destino de homologação e domínio

- Estado: pendente de decisão operacional; não autoriza deploy externo.
- Passo: 080.
- Data: 2026-11-12.
- Referências: arquitetura §11 e §11.1; roteiro passo 080; ADRs 0008 e 0041.

## Contexto

O passo 080 pede web, API, worker, PostgreSQL, Redis, object storage, domínio de staging e migrations controladas. Os repositórios não registram um provedor de hospedagem, domínio, credenciais de serviços gerenciados nem política de retenção/licença para snapshots oficiais. O ADR 0008 mantém snapshots de fontes oficiais bloqueados e o ADR 0041 mantém CSR enquanto hosting e domínio não forem escolhidos. A arquitetura requer secrets em cofre/ambiente e impede migrations destrutivas automáticas sem aprovação.

## Alternativas

1. Escolher provedor, domínio e storage por suposição e instalar um ambiente remoto.
2. Registrar os requisitos e manter a instalação externa pendente até a decisão operacional, sem impedir validações locais já cobertas por Docker e pelos testes offline.

## Decisão

Manter a alternativa 2. Não criar domínio, credenciais, buckets, retenção ou configuração específica de provedor. Um staging local via Docker não será chamado de homologação externa e não satisfaz o teste E2E em domínio real. Depois da escolha do provedor, implementar arquivos em `infra/staging/`, carregar segredos fora do Git, provisionar serviços isolados, validar backup/restore e executar migrations manualmente em revisão controlada. Não ativar armazenamento de snapshots oficiais sem revisão por fonte conforme ADR 0008.

## Pendências

- Selecionar hosting/domínio para web, API e worker.
- Selecionar PostgreSQL/Redis gerenciados, storage privado e política aprovada de retenção.
- Definir vault, TLS, rede, backups e política de restore.
- Executar migration apenas após backup, revisão do diff e aprovação operacional; validar em staging antes de produção.
- Executar smoke e E2E no ambiente remoto, provar start/stop/rollback e registrar evidências.

