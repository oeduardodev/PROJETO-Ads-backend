# ADR 0021 — evidência mínima para descarte heurístico de candidatos

- Estado: ACEITO pelo usuário no passo 037.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura § 4.3; roteiro 037; ADRs 0001 e 0003; `docs/domain/glossary.md`; corpus `docs/research/golden-dataset.csv`.

## Contexto

O roteiro 037 pede priorização por palavras-chave e descarte de SiSU regular, pós-graduação e cursos técnicos somente com evidência suficiente, encaminhando incertezas. A arquitetura § 4.3 fornece vocabulário, mas afirma que heurísticas apenas priorizam candidatos e que conteúdo e anexos prevalecem sobre o título da notícia. No estado atual, o parser de descoberta dispõe do texto âncora e da URL, sem o conteúdo do edital.

Uma ocorrência isolada de `SiSU` não distingue fluxo regular/SiSU+ de seleção própria por nota do ENEM; `técnico` também ocorre em `tecnólogo`; e referências a mestrado/doutorado podem aparecer em texto contextual que não define o objeto da seleção. A taxonomia do corpus exige preservar ENEM próprio fora do SiSU e remanescentes originados no SiSU em `PENDING_REVIEW`.

## Alternativas

1. **Marcador contextual explícito no texto âncora (recomendado):** descartar só quando o próprio texto do link nomeia inequivocamente o processo como fluxo regular do SiSU/SiSU+, pós-graduação ou curso técnico integrado. Termos isolados, URL e sinais contraditórios nunca bastam; positivos apenas elevam prioridade e incertezas seguem como candidatas.
2. **Nenhum descarte antes do documento:** heurísticas apenas ranqueiam links; exclusão ocorre após leitura do conteúdo oficial por etapa posterior. Evita falsos negativos nesta etapa, mas não executa descarte no passo 037.
3. **Termos de exclusão em texto âncora ou URL:** descartar quando qualquer termo seed aparece. É mais agressivo e pode excluir tecnólogos, seleções próprias que citam SiSU ou contextos que apenas mencionam pós-graduação.

## Decisão

Descartar apenas quando o texto âncora identificar explicitamente um processo de SiSU regular/SiSU+, pós-graduação ou curso técnico integrado. Menções isoladas, sinais encontrados somente na URL ou contexto contraditório não autorizam descarte. Termos positivos elevam prioridade; todo caso incerto segue como candidato.

## Consequências

- O classificador não decide elegibilidade nem publicação; prioridade e descarte heurístico são apenas triagem da URL candidata.
- A URL ajuda a priorizar, mas não pode, sozinha, retirar uma candidata da fila.
- ENEM em seleção própria, vagas remanescentes de origem SiSU e qualquer sinal conflitante seguem para etapas posteriores/revisão, preservando os rótulos humanos do corpus.
- As regras são determinísticas e cobertas por fixtures sintéticas e pelos casos identificados no corpus histórico oficial.
