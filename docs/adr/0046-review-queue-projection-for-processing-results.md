# ADR 0046 — projeção de resultados de processamento para revisão

- Estado: ACEITO pelo usuário em 2026-11-12.
- Referências: arquitetura §§ 5.2, 5.4, 6.2, 7.2 e 12.1–12.2; roteiro passo 079; ADR 0045.

## Contexto

Os artefatos de classificação e extração são persistidos imutavelmente por documento/hash/schema e os jobs agora se encadeiam. Sem conector ativado, os resultados ficam `PENDING_REVIEW`. A arquitetura descreve a fila administrativa de processos e os estados de ingestão, mas não define como um resultado incompleto de documento passa a ser um item visível para o curador. Hoje `GET /admin/review-queue` consulta somente `SelectionProcess`; resultados de processamento ainda não aparecem nessa fila.

É preciso manter a proveniência da URL candidata, documento, hash, evidências e resultado versionado, impedir duplicação em replay e evitar que dados parciais ganhem aparência de processo ou se tornem públicos sem confirmação humana.

## Alternativas

1. **Criar um `SelectionProcess` em RASCUNHO/NEEDS_REVIEW:** projetar os campos extraídos no processo assim que houver resultado, inclusive nulos, e anexar as evidências. A fila atual poderia exibir os fatos parciais. Exige identidade idempotente entre candidato e processo e regras de promoção/replay; o modelo atual não tem vínculo direto entre `DiscoveredUrl` e `SelectionProcess`.
2. **Fila própria de artefatos de processamento (recomendado):** criar registro/relação de revisão ligado à URL candidata e aos resultados imutáveis; a interface administrativa apresenta evidências e permite que um curador inicie ou associe um processo normalizado. Nenhum `SelectionProcess` é criado automaticamente a partir de resultado incompleto. Exige migration e extensão da API/UI administrativas.
3. **Esperar extração estruturada completa:** deixar `PENDING_REVIEW` fora da fila administrativa até existir `ExtractionV1` completa e validada; depois criar processo para revisão. Evita itens incompletos na UI, mas não oferece revisão humana para resolver exatamente os casos pendentes.

## Decisão

Criar fila própria de artefatos ligada à URL candidata, documento/hash e resultados imutáveis. O curador pode associar um processo existente ou criar um rascunho explicitamente; o worker não cria `SelectionProcess`. Toda ação administrativa usa identidade mapeada no servidor, justificativa, optimistic lock e trilha de auditoria. Rascunhos permanecem invisíveis à API pública.

## Consequências

- G2/G5 continuam pendentes; o encadeamento BullMQ até resultados `PENDING_REVIEW` e sua fila autenticada de artefatos não são o fluxo único de extração real, curadoria completa, API pública e browser.
- Nenhum resultado pendente é público e nenhum processo é criado automaticamente pelo worker.
- A resolução da fila usa o estado `RESOLVED` para cobrir tanto associação a processo existente quanto criação explícita de rascunho.
- A fila mantém uma linha idempotente por documento/hash e agrega resultados por versão. O vínculo a um processo é criado somente pela ação explícita do curador, com revisão humana antes de publicação.
