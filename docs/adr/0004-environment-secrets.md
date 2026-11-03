# ADR 0004 — Momento de exigência dos segredos de integrações

- Estado: ACEITO para o passo 010, por decisão do usuário.
- Data: 2026-11-02 (America/Sao_Paulo).
- Referências: arquitetura §§ 7.1–7.2, 10.3 e 11.1; roteiro 009–010.

## Contexto

A arquitetura lista `SEARCH_PROVIDER_KEY` e `LLM_PROVIDER_KEY` para o worker, mas não define se a ausência dessas chaves deve impedir a inicialização antes de existirem conectores. O passo 010 exige validação clara dos segredos obrigatórios e separação do bundle público. Exigir chaves ainda não usadas tornaria a fundação local dependente de provedores externos.

## Alternativas

1. Exigir as chaves na inicialização da API e do worker já no passo 010.
2. Exigir cada chave quando o respectivo conector for ativado, com falha clara antes de qualquer chamada externa.

## Decisão

O usuário escolheu a alternativa 2. Os valores de busca e IA ficam fora do frontend e do Git, aparecem vazios no `.env.example` e não são exigidos pelos processos atuais. Cada etapa que introduzir um conector deve validar sua chave na inicialização do componente ou job que a utiliza, sem imprimir o valor. `DATABASE_URL` e `REDIS_URL` já são obrigatórios para a configuração da API e do worker; `CORS_ORIGINS` é obrigatório para a API. A configuração não estabelece ainda provedor de busca, IA, autenticação ou storage.

## Consequências e aceite

- API e worker devem falhar com mensagem que identifica a variável ausente, sem revelar segredo.
- Um build do Angular não deve conter nomes nem valores de credenciais privadas.
- Quando os conectores forem implementados, seus testes devem cobrir ausência, valor inválido e inicialização com segredo fora do Git.
