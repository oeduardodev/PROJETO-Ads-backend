# Candidatos ao corpus do passo 004

`candidate-manifest.csv` contém 48 URLs oficiais localizadas nas quatro instituições do piloto. A coluna `review_state` distingue 35 candidatos promovidos ao gabarito dos 13 que continuam apenas como candidatos. A lista inclui páginas de download da UEPB; o gabarito usa as URLs PDF resolvidas na leitura individual. `case_intent` expressa o motivo da amostragem, não prova elegibilidade ou dados do edital. O gabarito está em `docs/research/golden-dataset.csv` e mantém `UNKNOWN` quando o documento observado não sustenta um campo.

Não há PDFs, dados pessoais, conteúdos integrais de editais nem informações de inscrição copiados para o Git. As páginas de resultado com listas nominais foram evitadas. O corpus final deve registrar, por campo, valor confirmado ou `unknown`, seção/página de evidência, URL oficial, data da conferência, vínculo entre retificação e original e justificativa de inclusão/exclusão. Quando uma página HTML só aponta para PDF, os campos internos do PDF continuam não confirmados.

O ADR 0003 adotou `PENDING_REVIEW` para seleções próprias de vagas remanescentes originadas no SiSU, como `UFCG-02`, `UEPB-01` e `UEPB-04`. Esses rótulos não autorizam publicação. `IFPB-01` e `IFPB-02` permanecem somente como candidatos por serem processos futuros na data da pesquisa.
