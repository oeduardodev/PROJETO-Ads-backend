# Rollback de aplicação e migrations

Este procedimento orienta uma futura instalação em staging. Não há provedor nem release implantado para ensaiar (ADR 0044), e o documento não autoriza deploy, restore ou migration de produção.

## Resposta inicial

1. Interromper promoção e novas migrations; registrar versão/tag, horário, ambiente, sintomas e responsável.
2. Se a falha estiver na aplicação, manter o banco e reverter o serviço afetado para o artefato imutável anterior (digest de container ou artefato frontend versionado). Não reescrever histórico nem usar force push.
3. Validar health/readiness, rotas públicas, revisão administrativa e métricas; manter rollback se os checks não recuperarem.
4. Preservar logs e auditoria. Só encerrar incidente depois de revisão humana e registro da causa/ação.

## Compatibilidade com schema

- Preferir mudanças expand/contract: adicionar schema compatível, implantar aplicação que lê/escreve ambos quando necessário, migrar dados em lote monitorado e remover campos antigos apenas em release posterior.
- Se a migration for aditiva e a versão anterior da aplicação continuar compatível, reverter apenas a aplicação e preparar correção forward da base.
- Não executar migration down destrutiva nem `prisma migrate reset` em banco persistente. Não restaurar backup por padrão: restauração pode apagar gravações aceitas após o snapshot.
- Se houver corrupção comprovada, suspender escrita, preservar evidências, verificar backup e plano de recuperação, calcular perda de dados e obter aprovação explícita para o ambiente antes de restaurar. Seguir [backup-restore.md](backup-restore.md).
- Migration crítica só começa após revisar SQL/diff, backup e restore testados, janela, sinais de abortar, plano de recuperação e aprovador. Confirmar `_prisma_migrations`, constraints e consultas depois.

## Prova exigida antes do gate

Em staging, testar falha de aplicação e retorno ao artefato anterior, confirmar compatibilidade entre schema e app, executar smoke/E2E e documentar tempo/resultado. A promoção de produção requer gate manual e autorização explícita; nunca usar força para contornar branch protection.

