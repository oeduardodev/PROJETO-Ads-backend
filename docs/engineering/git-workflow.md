# Fluxo Git e proteção de `main`

Os repositórios de backend e frontend são independentes (ADR 0000). Cada mudança deve usar uma branch curta, um PR para `main` e o workflow `CI` do repositório afetado. Mudanças coordenadas citam os dois SHAs no registro canônico `docs/implementation/PROGRESS.md` do backend. A sequência de passos do roteiro governa os commits locais.

## Política de PR

1. Criar branch a partir de `main`, com nome que indique a tarefa (`feat/...`, `fix/...`, `chore/...`).
2. Manter o PR limitado ao passo ou correção, com motivação, testes executados, riscos e referência ao passo.
3. Exigir `quality` verde antes de mesclar. O job executa instalação com lockfile congelado, `format:check`, lint, typecheck, testes unitários e build. Testes E2E completos serão adicionados no gate correspondente.
4. Revisar código, fontes e efeitos nos dados. A aprovação de CI não autoriza publicação de edital, migration de produção ou deploy.
5. Mesclar apenas após revisão humana; evitar commits diretos em `main` quando a proteção estiver ativa. Não incluir `.env`, tokens, PDFs sem licença ou dados pessoais no Git.

## Configuração futura no GitHub

Quando os repositórios tiverem branches remotos e houver autorização para publicar, configurar rulesets de `main` em **Settings → Rules → Rulesets** nos dois repositórios: exigir PR, ao menos uma aprovação, status obrigatório `quality`, branches atualizados antes da mesclagem, impedir force push e exclusão. Não conceder bypass geral. Confirmar o nome real do status após a primeira execução remota e registrar a evidência aqui.

O usuário proibiu push. Os repositórios remotos estão vazios; por isso a proteção remota e a execução em PR no GitHub ainda não podem ser comprovadas. A validação local do workflow será registrada em `PROGRESS.md`, sem atribuir a ela o status de execução hospedada.
