# ADR 0042: limite global de requisicoes da API

- Status: proposta pendente de decisao
- Passo: 076
- Data: 2026-11-11

## Contexto

O passo 076 exige cobertura automatizada contra abuso de endpoints, mas a arquitetura nao define limites gerais, janela, identificador do cliente nem comportamento atras de proxy. O sistema ja aplica cooldown Redis atomico de 60 segundos por host exato em `POST /admin/sources/:id/run` (ADR 0038). A API nao configura atualmente proxy confiavel, portanto `X-Forwarded-For` nao e uma origem de identidade segura.

## Proposta

Antes de habilitar limite global, confirmar os limites operacionais e a infraestrutura de proxy. Uma opcao a avaliar e Redis atomico com 120 GET/minuto por IP de socket e 30 mutacoes administrativas/minuto por principal, ignorando `X-Forwarded-For` ate existir configuracao explicita de proxies confiaveis. O cooldown do ADR 0038 permanece independente.

Esta proposta nao ativa novos limites globais. A cobertura deste passo comprova o limite do disparo manual, rejeicao segura de destinos e redirects internos, e controles de cabecalhos/CORS. A exposicao publica deve permanecer atras de protecao de taxa no ingress ate que a politica de aplicacao seja decidida e implementada.

## Consequencias

- Nao se assume uma politica de identidade de cliente nem se altera o comportamento das rotas sem decisao operacional.
- O abuso repetido do endpoint manual de coleta continua limitado e testado.
- Limites gerais de borda e por rota permanecem pendentes; esta decisao deve ser revista antes de disponibilizar a API publicamente.

