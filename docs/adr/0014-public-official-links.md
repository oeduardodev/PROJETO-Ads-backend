# ADR 0014 — links oficiais na leitura pública

- Estado: ACEITO; decisão explícita do usuário no passo 027.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 7–9 e 12; roteiro 027; ADRs 0006 e 0011.

## Contexto

O detalhe público deve exibir fonte institucional, instruções e evidências sem transformar um link HTTPS arbitrário em fonte oficial. O schema guarda URLs no processo, janelas e documentos; esses campos não são, por si, prova de vínculo institucional. A allowlist é por host exato e a listagem de instituições já exige fonte ativa em domínio revisado.

## Alternativas

1. Exigir que cada URL exibida use o host exato de um domínio revisado da mesma instituição e associado a uma fonte ativa. Ocultar links secundários fora desse conjunto; se a URL principal não passar, o processo não é público. Aplicar a regra também à busca e às facetas para manter contagens e detalhes coerentes.
2. Aceitar domínio revisado sem fonte ativa.
3. Exigir revisão individual de cada URL além do domínio/fonte.

## Decisão e consequências

O usuário escolheu a alternativa 1. A validação exige HTTPS sem credenciais ou porta especial e host exatamente igual ao domínio revisado vinculado a uma fonte `ACTIVE` da instituição. Links de instrução e documento que não passarem ficam ausentes da resposta; evidências sem documento oficial exibível não são mostradas no detalhe. A URL principal inválida torna o processo inacessível por `/processes/:id`, lista e facetas. Isso é um filtro de publicação da API; não autoriza crawling, armazenamento de documentos nem aprovação editorial automática. Novos hosts exigem revisão própria.
