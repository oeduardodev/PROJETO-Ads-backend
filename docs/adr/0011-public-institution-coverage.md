# ADR 0011 — diretório público e cobertura de instituições

- Estado: ACEITO; duas escolhas explícitas do usuário no passo 024.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 7–9 e 12; roteiro 024; `docs/research/source-matrix.csv`.

## Contexto

`GET /institutions` deve mostrar instituições públicas suportadas, campi e cobertura verificada. O cadastro institucional tem `verified_at`, enquanto as fontes têm estados e horários de checagem/sucesso. A presença de uma fonte no inventário não prova cobertura integral ou autorização para coleta. As quatro instituições da seed permanecem com `verified_at` nulo.

## Alternativas

1. Listar somente instituição pública com `verified_at` e ao menos uma fonte `ACTIVE` com domínio revisado; divulgar apenas contagem e último sucesso/checagem dessas fontes, sem URLs, seletores ou configuração interna. Chamar essa informação de monitoramento observado, sem afirmar cobertura completa. É a proposta.
2. Exigir somente cadastro institucional verificado; a cobertura pode estar ausente e vir nula.
3. Listar cadastro sem verificação, distinguindo claramente o estado; não satisfaz o título do passo.

## Decisão e consequências

Alternativa 1 escolhida. Exigir `public_flag`, `verified_at` institucional, fonte `ACTIVE` em domínio revisado e jurisdição federal/estadual. Campi terão `verified_at` individual e só os revisados aparecerão. A resposta expõe apenas contagem de fontes ativas revisadas e horários agregados de checagem/sucesso; `null` significa que ainda não há verificação bem-sucedida, não cobertura completa. URLs, seletores e configuração das fontes permanecem internos. A seed continua fora do diretório.
