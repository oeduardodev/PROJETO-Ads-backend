# Convenções Git

Os projetos `backend/` e `frontend/` são repositórios separados por decisão do ADR 0000. O backend mantém o roteiro, os ADRs e `PROGRESS.md` canônicos. Não usar push, deploy ou migração em produção sem autorização explícita.

Cada passo do roteiro recebe o ID anunciado antes do commit. Inspecionar o estado real do repositório, consultar as seções indicadas da arquitetura, limitar o diff ao passo, executar a validação prescrita e registrar evidências no progresso. Commit apenas com checks verdes e mensagem Conventional Commits:

```text
<type>(<scope>): <descrição no imperativo>
```

Tipos usuais: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`. `scope` identifica o módulo ou área. Correções coordenadas entre os repositórios exigem dois SHAs e ordem registrados no progresso. Usar `corepack pnpm` se o executável `pnpm` não estiver instalado globalmente; a versão é fixada no `packageManager` de cada raiz.
