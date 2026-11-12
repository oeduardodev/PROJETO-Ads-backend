# ADR 0044 — pipeline de release e rollback supervisionado

- Estado: pendente do provedor e da autorização operacional; sem deploy automático ativo.
- Passo: 083.
- Data: 2026-11-12.
- Referências: arquitetura §§ 10.3 e 11–11.1; roteiro passo 083; ADRs 0000, 0041 e 0043.

## Contexto

O checkpoint pede deploy automático em staging, promoção manual para produção, aprovação explícita de migrations e rollback sem force push. Os repositórios remotos estão vazios e push foi proibido. Não existem ambiente GitHub protegido, provedores, domínios, secrets ou deploy anterior de staging para testar. O CI atual só verifica qualidade; seus gatilhos `push` descrevem execução futura quando autorizada e não concedem permissão para publicar.

## Alternativas

1. Escolher provedor e configurar workflow de deploy sem decisão operacional ou credenciais.
2. Registrar os controles de release e rollback, manter CI sem deploy e aguardar destino, permissões e autorização de publicação para implementar e ensaiar os jobs reais.

## Decisão

Manter a alternativa 2. Não criar workflow de release que aparente realizar deploy sem destino configurado. Quando staging for escolhido, o pipeline deve construir artefatos imutáveis, implantar staging, executar smoke/E2E e só então oferecer promoção de produção com aprovação de ambiente. Migrations ficam em job separado, manual e com aprovação; nunca executar DDL destrutivo no startup. Usar tags/versionamento e reverter a imagem para digest anterior quando o schema for compatível. Mudanças destrutivas exigem plano expand/contract, backup verificado e aprovação; evitar restore como rollback padrão porque ele pode perder gravações posteriores. Nunca usar force push para reescrever histórico publicado.

## Pendências

- Provedor, domínio, vault, storage e rede para staging/produção (ADR 0043).
- Rulesets remotos para `main`, PR obrigatório e revisão; provar status obrigatório `quality` após primeira execução hospedada.
- Jobs de deploy por ambiente, approval gates, assinatura/proveniência de artefatos e rollback automatizado testado.
- Evidência de deploy e rollback em staging e permissão de cada ambiente. Produção continua exigindo autorização explícita do usuário.

