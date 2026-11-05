# Snapshots documentais

O passo 018 cria `document_blobs` com identidade SHA-256 e `documents` com URL, MIME, versão, captura, último avistamento e `storage_key`. O mesmo conteúdo em URLs diferentes compartilha o blob; uma mudança de bytes cria nova versão para a URL. Repetir o conteúdo mais recente atualiza o último avistamento. Se o conteúdo antigo reaparecer após uma revisão, uma nova versão referencia o blob existente. O banco mantém todas as versões e verifica hash, tamanho, MIME e vínculos de storage.

`FixtureLocalStorage` grava **somente fixtures sintéticas de teste**, sob o diretório temporário do sistema e com `NODE_ENV=test`. O repositório aceita apenas URLs `fixture://local/...`. O fetcher do passo 041 usa `ResponsibleHttpClient`, verifica status, bytes, assinatura HTML/PDF, MIME e extensão, e retorna hash e metadados da origem; ele não grava snapshots oficiais. Nenhum endpoint, job ou fonte está ativado para download real.
`MAX_PDF_BYTES` tem default de 10 MiB no `WorkerConfig`. `fetchTypedArtifact` exige `maxBytes`; o caller deve passar o mesmo limite ao cliente HTTP e ao fetcher quando o worker for conectado.

Conforme o ADR 0008, snapshots oficiais permanecem bloqueados até haver revisão por fonte de licença, acesso e prazo de retenção, além de um adaptador de storage de produção escolhido e configurado. A URL oficial continua sendo a referência pública. Validação de MIME real, limite de tamanho e descarte/expiração entram no fluxo de coleta autorizado, não são presumidos pela existência das tabelas.
