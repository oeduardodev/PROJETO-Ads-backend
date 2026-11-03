# Evidências e revisão

`evidence` associa um campo do processo a uma versão concreta do documento, trecho e seção/página opcionais. `revisions` forma uma cadeia por processo: cada retificação referencia a versão anterior e um novo documento, sem sobrescrever os dados anteriores. `review_decisions` registra o identificador do revisor, decisão, motivo e horário. O revisor é uma referência textual até a identidade administrativa ser definida em etapa própria.

Triggers PostgreSQL proíbem UPDATE e DELETE dessas três tabelas. Correções exigem novas linhas. O teste de integração usa documentos e processo sintéticos dentro de uma transação revertida.

`publication_status` no processo começa em `RASCUNHO` e é independente dos estados de descoberta e captura. Este passo não oferece comando de publicação; as regras de validação e aprovação humana ainda serão implementadas. Não há dados reais publicados.
