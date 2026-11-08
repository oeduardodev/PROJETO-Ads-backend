# Autenticação administrativa

O módulo `AuthModule` expõe `AuthenticationGuard` para rotas administrativas.
O guard é opt-in; rotas públicas continuam anônimas. Configuração ausente não
impede iniciar a API pública, mas uma rota protegida falha fechada se as
variáveis de auth não estiverem configuradas.

Configure `ADMIN_AUTH_ISSUER`, `ADMIN_AUTH_AUDIENCE` e
`ADMIN_AUTH_JWKS_URL` juntas. O verificador valida assinatura assimétrica,
`iss`, `aud`, `sub` e `exp` usando `jose`, permitindo `RS256`, `ES256` ou
`EdDSA`. Chaves JWKS ficam em cache por até dez minutos e requisições têm
timeout de cinco segundos. Tokens compartilhados `HS256` não são aceitos.

O principal autenticado fica em `request.auth` e inclui subject e claims
verificados. A extração de roles e a autorização ADMIN/CURATOR pertencem ao
passo 059. Nenhuma chave privada, segredo de assinatura ou credencial de
provedor é armazenada neste repositório.

Veja o [ADR 0035](../adr/0035-admin-token-provider.md): o adaptador aceita
issuer/JWKS OIDC configuráveis, e Supabase Auth continua sendo a recomendação
pendente de ativação operacional.
