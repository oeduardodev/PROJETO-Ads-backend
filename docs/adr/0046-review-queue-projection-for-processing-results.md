# ADR 0046 — projeção de resultados de processamento para revisão

- Estado: PROPOSTO; decisão pendente.
- Referências: arquitetura §§ 5.2, 5.4, 6.2, 7.2 e 12.1–12.2; roteiro passo 079; ADR 0045.

## Contexto

Os artefatos de classificação e extração são persistidos imutavelmente por documento/hash/schema e os jobs agora se encadeiam. Sem conector ativado, os resultados ficam `PENDING_REVIEW`. A arquitetura descreve a fila administrativa de processos e os estados de ingestão, mas não define como um resultado incompleto de documento passa a ser um item visível para o curador. Hoje `GET /admin/review-queue` consulta somente `SelectionProcess`; resultados de processamento ainda não aparecem nessa fila.

É preciso manter a proveniência da URL candidata, documento, hash, evidências e resultado versionado, impedir duplicação em replay e evitar que dados parciais ganhem aparência de processo ou se tornem públicos sem confirmação humana.

## Alternativas

1. **Criar um `SelectionProcess` em RASCUNHO/NEEDS_REVIEW:** projetar os campos extraídos no processo assim que houver resultado, inclusive nulos, e anexar as evidências. A fila atual poderia exibir os fatos parciais. Exige identidade idempotente entre candidato e processo e regras de promoção/replay; o modelo atual não tem vínculo direto entre `DiscoveredUrl` e `SelectionProcess`.
2. **Fila própria de artefatos de processamento (recomendado):** criar registro/relação de revisão ligado à URL candidata e aos resultados imutáveis; a interface administrativa apresenta evidências e permite que um curador inicie ou associe um processo normalizado. Nenhum `SelectionProcess` é criado automaticamente a partir de resultado incompleto. Exige migration e extensão da API/UI administrativas.
3. **Esperar extração estruturada completa:** deixar `PENDING_REVIEW` fora da fila administrativa até existir `ExtractionV1` completa e validada; depois criar processo para revisão. Evita itens incompletos na UI, mas não oferece revisão humana para resolver exatamente os casos pendentes.

## Decisão

Pendente de decisão. Não projetar automaticamente resultados para `SelectionProcess`, não criar tabela/endpoint/UI de intake e não alterar a fila administrativa até a escolha ser registrada.

## Consequências

- G2/G5 continuam pendentes; o encadeamento BullMQ até resultados `PENDING_REVIEW` não é o fluxo único de extração, curadoria, API e browser.
- O estado atual permanece seguro: nenhum resultado pendente é público e nenhum processo é criado automaticamente por esse caminho.
- Após decisão, a implementação deverá preservar idempotência, associação exata de documento/hash/schema, citações verificáveis e revisão humana; replays não podem alterar auditoria nem publicar dados.
