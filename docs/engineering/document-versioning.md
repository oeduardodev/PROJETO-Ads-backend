# Versionamento e relações entre documentos

Cada `Document` representa um snapshot de uma URL canônica e conserva seu
próprio ID, SHA-256, chave de storage, MIME, versão e horário de captura.
Conteúdo novo na mesma URL cria uma nova versão. Repetir os mesmos bytes mantém
a identidade da versão e atualiza apenas `lastSeenAt`; bytes iguais em URLs
diferentes compartilham `DocumentBlob`, mas continuam como documentos distintos.

`DocumentRelation` liga uma versão de origem a uma versão relacionada. O tipo
indica `ATTACHMENT`, `TIMELINE`, `RECTIFICATION` ou `RELATED`. Os vínculos são
direcionados, não inferidos pelo número do edital, ano ou hash. Assim, snapshots
anteriores preservam os vínculos que foram observados naquela versão; uma nova
versão recebe relações próprias quando elas forem extraídas e revisadas.

O par de IDs e tipo é único, e a escrita usa upsert sem atualizar o vínculo
existente, tornando a repetição idempotente. Não se permite auto-relação. As
chaves estrangeiras impedem apagar documentos que ainda são referenciados. O
repositório não cria snapshots oficiais; armazenamento e retenção continuam sob
a política do ADR 0008.
