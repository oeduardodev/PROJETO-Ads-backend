# Snapshots documentais

O passo 018 cria `document_blobs` com identidade SHA-256 e `documents` com URL, MIME, versão, captura, último avistamento e `storage_key`. O mesmo conteúdo em URLs diferentes compartilha o blob; uma mudança de bytes cria nova versão para a URL. Repetir o conteúdo mais recente atualiza o último avistamento. Se o conteúdo antigo reaparecer após uma revisão, uma nova versão referencia o blob existente. O banco mantém todas as versões e verifica hash, tamanho, MIME e vínculos de storage.

O adaptador `FixtureLocalStorage` grava **somente fixtures sintéticas de teste**, sob o diretório temporário do sistema e com `NODE_ENV=test`. O repositório aceita apenas URLs `fixture://local/...`. Não há endpoint, job ou método que grave bytes de fontes oficiais neste passo. O teste de integração usa HTML sintético e não baixa nem copia PDF institucional.

Conforme o ADR 0008, snapshots oficiais permanecem bloqueados até haver revisão por fonte de licença, acesso e prazo de retenção, além de um adaptador de storage de produção escolhido e configurado. A URL oficial continua sendo a referência pública. Validação de MIME real, limite de tamanho e descarte/expiração entram no fluxo de coleta autorizado, não são presumidos pela existência das tabelas.
