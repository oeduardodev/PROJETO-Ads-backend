# ADR 0028 — limite do replay offline de ingestão

- Estado: ACEITO; escolha explícita do usuário no passo 047.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 3.1, 4.2, 5.2, 7.2, 11.2 e 12.1; roteiro 047; ADRs 0008 e 0027.

## Contexto

O checkpoint 047 pede validar por replay offline o caminho fixture → documento
→ texto → hash, com testes end-to-end do worker e contagem de falhas por
categoria. O repositório contém o bootstrap `WorkerModule`, produtores de jobs,
cliente HTTP responsável, fetch tipado, persistência local de fixtures e
parsers HTML/PDF. Ainda não há consumidores BullMQ nem serviço de ingestão que
conecte esses componentes. A persistência de snapshots oficiais permanece
bloqueada pelo ADR 0008, e a integração PostgreSQL de teste não está disponível
neste ambiente.

## Alternativas

1. **Replay offline dos componentes existentes:** adicionar um teste E2E com
   transporte HTTP determinístico e adapters em memória/armazenamento local de
   fixture. O teste exercita fetch, deduplicação por hash, persistência de
   fixture, parsing HTML/PDF e métricas de falha, sem alegar que exercita
   entrega ou consumo BullMQ. Mantém o passo 047 dentro do escopo explícito do
   roteiro; consumidores ficam para um passo próprio.
2. **Consumidores BullMQ como pré-requisito do teste:** ampliar o passo para
   implementar os primeiros processors `url.fetch` e `document.extract`,
   configuráveis com adapters de teste, e validar entrega/retry/replay no
   worker. Isso prova o fluxo real de fila, mas introduz comportamento de
   produção e dependências além do passo marcado como teste; a validação de
   integração com Redis/PostgreSQL continua condicionada aos serviços locais.

## Decisão

O usuário escolheu a alternativa 1. O passo 047 valida a composição offline do
fetch responsável, snapshot sintético, parser HTML/PDF e cache por meio de
transporte determinístico e adapters locais/em memória. O teste mede falhas
pelas categorias de erro dos componentes e comprova hash, texto, replay e
ausência de acesso de rede real.

O teste não afirma validar entrega ou consumo BullMQ. Os primeiros consumers
continuam sendo trabalho funcional separado; não foram adicionados ao passo
047. Nenhum endereço real ou edital foi acessado.
