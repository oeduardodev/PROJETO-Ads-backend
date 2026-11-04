# Filas de jobs

O worker registra seis filas BullMQ com PostgreSQL como sistema de registro e
Redis apenas como transporte durável:

| Fila | Payload mínimo | Chave de job |
| --- | --- | --- |
| source.refresh | sourceId, scheduleVersion | fonte + versão do agendamento |
| url.fetch | candidateUrlId | candidata |
| document.classify | documentId, sha256 | documento + hash |
| document.extract | documentId, schemaVersion | documento + schema |
| process.validate | processId, revision | processo + revisão |
| process.recheck | processId, dueAt | processo + instante UTC |

Os produtores usam IDs estáveis, até três tentativas, backoff exponencial com
jitter de 50% e jobs concluídos retidos por até sete dias/1.000 itens para
deduplicação recente. Jobs que esgotam tentativas permanecem no conjunto
failed da própria fila, sem remoção automática; curadoria operacional pode
inspecionar e repetir o registro pela API BullMQ. A fila trabalha com entrega
at-least-once, portanto processadores futuros devem tolerar repetição.

Payloads contêm IDs, versões e hashes, nunca bytes de edital, texto extraído,
credenciais ou segredos. O módulo é importado pelo processo worker; a API
pública não cria clientes de fila e continua separada dos consumidores.

O registro de producer fecha todas as filas no shutdown do Nest. Processadores
serão registrados nos passos de descoberta/extração quando suas regras de
negócio existirem; este passo não consome jobs com handlers vazios.
