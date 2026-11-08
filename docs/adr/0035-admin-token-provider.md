# ADR 0035 — provedor de identidade administrativa

- Estado: PROPOSTO no passo 058.
- Data: 2026-11-08 (America/Sao_Paulo).
- Referências: arquitetura §§ 7–9; roteiro 058; [Supabase JWT/JWKS](https://supabase.com/docs/guides/auth/jwts); [jose remote JWKS](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md).

## Contexto

A arquitetura define autenticação administrativa, mas não escolhe provedor. O
roteiro sugere Supabase Auth como padrão. A API pública deve continuar anônima.
O backend pode verificar tokens por JWKS sem receber chaves privadas ou
segredos de assinatura.

## Alternativas

1. Supabase Auth com chaves assimétricas e claims `iss`, `aud`, `sub`, `exp`,
   validando assinatura contra JWKS remoto.
2. Outro provedor OIDC configurado pelos mesmos valores de issuer, audience e
   JWKS URL.
3. Chave simétrica compartilhada ou introspecção online do token.

## Implementação do passo 058

O backend implementa um verificador JOSE compatível com as opções 1 e 2,
limitado a assinaturas assimétricas (`RS256`, `ES256`, `EdDSA`). A configuração
é opcional no processo público e exigida somente quando um guard de autenticação
é executado. JWT compartilhado `HS256` e introspecção não são implementados.

O provedor operacional deve ser escolhido e configurado antes de habilitar
rotas administrativas. Supabase Auth é a recomendação do roteiro, não uma
conexão externa ativa nem credencial criada por este commit.
