# Homologação

Este diretório está reservado para a configuração do ambiente isolado do passo 080. O provedor de hospedagem, domínio, serviços gerenciados e storage ainda não foram escolhidos (ADR 0043); por isso não há manifestos executáveis nem endpoint de homologação configurado.

Não substitua estes valores por domínio ou credenciais inventados. Não use `compose.dev.yml` como homologação: ele contém somente PostgreSQL e Redis locais de desenvolvimento. A instalação deve incluir web, API e worker separados, PostgreSQL e Redis isolados, storage privado habilitado apenas após revisão de retenção, TLS e secrets em vault. Migrations devem ser uma ação manual revisada, depois de backup e com procedimento de rollback documentado.

Os testes `pnpm test:e2e:offline` e `pnpm test:integration` verificam componentes localmente; não comprovam deploy ou E2E em homologação.

