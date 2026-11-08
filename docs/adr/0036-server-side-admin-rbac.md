# ADR 0036: papéis administrativos locais por issuer e subject

- Status: aceita
- Passo: 059
- Data: 2026-11-08

## Contexto

A arquitetura exige autenticação, RBAC para `CURATOR`/`ADMIN` e trilha auditável, mas não define se os papéis vêm de claims do provedor ou de cadastro da própria aplicação. O provedor de identidade do ADR 0035 também permanece configurável.

## Decisão

Os papéis são atribuídos no banco da aplicação e associados à identidade pelo par exato `(issuer, subject)` do JWT validado. A autorização consulta um cadastro ativo no servidor em cada requisição protegida. Claims de papel do provedor não concedem acesso. A primeira versão suporta um papel por identidade, `CURATOR` ou `ADMIN`; usuários sem linha ativa são negados.

Operações críticas registram evento de auditoria com ator local e snapshot de identidade, ação, recurso, motivo obrigatório, estado anterior/posterior limitado e ID de requisição opcional. Snapshots que contêm nomes de campos de segredo são recusados. A API não oferece autoelevação de papel.

## Consequências

- Criar ou alterar usuários/papéis requer acesso administrativo controlado ao banco até existir uma ferramenta de provisionamento auditada.
- Issuer e subject permanecem independentes de um fornecedor específico; trocar o provedor exige mapear deliberadamente as identidades.
- As guards server-side são a barreira real; guards no frontend serão apenas conveniência visual.
- O repositório de auditoria só expõe inserção. A política de privilégios de banco para impedir UPDATE/DELETE deverá ser aplicada na configuração operacional antes do uso produtivo.
- A migration criada neste passo não foi aplicada a qualquer banco.

## Alternativas consideradas

- Claims de role assinadas: rejeitada por acoplar autorização a configuração/provisionamento do IdP e dificultar revogação local imediata.
- Um papel múltiplo via tabela associativa: adiada; o roteiro exige dois papéis, mas não exige composição. A decisão evita grants implícitos e ampliações de permissão nesta versão.
