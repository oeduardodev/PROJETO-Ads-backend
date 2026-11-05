# ADR 0007 — identidade de URLs descobertas

- Estado: ACEITO; decisão explícita do usuário no passo 017.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.2–4.3, 6 e 7.2; roteiro 017.

## Contexto

O roteiro exige que detectar a mesma URL canônica duas vezes não crie dois candidatos. A arquitetura também pede a fonte que descobriu cada URL, mas não define se a identidade do candidato é global ou por instituição. Uma URL pode aparecer em mais de uma fonte e sua proveniência precisa ser preservada sem publicação automática.

## Alternativas

1. **Identidade global por URL canônica:** um candidato único; cada observação registra fonte, execução e momento. Evita duplicatas entre fontes e conserva proveniência múltipla. É a proposta.
2. **Identidade por instituição e URL:** a mesma URL pode gerar candidatos distintos se fontes de instituições diferentes a apontarem. Preserva separação institucional, mas exige deduplicação adicional antes de vincular documentos e processos.

## Decisão e consequências

Decisão: alternativa 1. `discovered_urls.canonical_url` terá unicidade global. Uma tabela de observações ligará candidato, fonte e execução; repetir a mesma descoberta atualiza somente o contador/última observação e não publica nada. A normalização conservará query string, removerá fragmento e exigirá HTTPS com host DNS público. Redirecionamentos e DNS serão validados no fetch futuro. A escolha foi confirmada antes da migration 017.

> Nota de evolução: a contagem por repetições do mesmo `crawlRunId` foi refinada pelo ADR 0022 no passo 040. A identidade global por URL e a proveniência múltipla permanecem vigentes.
