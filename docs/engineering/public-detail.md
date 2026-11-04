# Detalhe público de processo — passo 027

`GET /api/v1/processes/:id` recebe UUID. ID malformado responde 400; processo inexistente, em rascunho, histórico de demonstração, oculto ou sem URL principal oficialmente validada responde 404. A API retorna somente processos publicados, revisados, de graduação pública gratuita fora do fluxo regular do SiSU.

A resposta contém instituição, edital, tipo de seleção, ENEM trivalente, data de verificação e link principal; ofertas com campus individualmente verificado, reservas de vagas, janelas com data civil e hora separadas, requisitos e evidências com documento. Hora ausente continua `null`. Dados internos de fonte e revisão, como seletor, identidade do curador, justificativa, hash e chave de storage, não são projetados.

Cada URL exibida precisa passar pela regra do ADR 0014: HTTPS válido e host exato de domínio revisado da instituição, ligado a fonte ativa. URL principal inválida remove o processo da lista, facetas e detalhe; links secundários inválidos ficam nulos, e evidência sem documento com link válido não é exibida. O teste usa dados sintéticos em transação revertida. Essa checagem não substitui a revisão humana de editais e links antes de uma publicação real.
