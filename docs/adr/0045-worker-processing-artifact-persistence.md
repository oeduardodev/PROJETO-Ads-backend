# ADR 0045 — persistência de resultados de classificação e extração

- Estado: PROPOSTO; decisão pendente do usuário.
- Referências: arquitetura §§ 5.1–5.2, 6 e 7.2; roteiro passo 079; ADRs 0008, 0027 e 0028.

## Contexto

As filas `document.classify` e `document.extract` e seus produtores existem, mas não há consumidores BullMQ. O schema persiste blobs e cache de parsing por SHA-256/tipo/versão e mantém processos e evidências normalizados, porém não define uma entidade para os resultados de classificação e extração que alimentariam esses processos. Sem uma decisão, não é seguro criar consumidores que descartem resultados, serializem JSON num campo não destinado a isso ou imponham uma nova migration implicitamente.

## Alternativas

1. **Resultados tipados e imutáveis por documento/hash/versão de schema (recomendado):** persistir classificação e extração validadas em registros próprios, com estado, versão, evidências e chave idempotente. O processo normalizado e seus registros de evidência são derivados depois; replays consultam o resultado existente. Exige tabelas/migration e retenção alinhada à política aprovada para cada fonte. Não autoriza guardar bytes oficiais nem ativar fontes.
2. **Somente processo normalizado, evidências e estado de revisão:** projetar a saída direto em `SelectionProcess`/`Evidence`, preservar motivos resumidos em `ingestionStateReason` e descartar o JSON intermediário. Reduz schema, mas não mantém saída bruta/versionada para replay e auditoria do modelo.

## Decisão

Pendente. Não conectar os consumidores de classificação/extração até o usuário escolher uma alternativa. A proposta recomendada não muda os limites do ADR 0008: execução atual usa apenas fixtures sintéticas locais; snapshots oficiais continuam bloqueados até revisão de licença, retenção e storage.

## Consequências

- A validação offline atual continua útil, mas não comprova o pipeline único do passo 079 nem aprova G5.
- Após a decisão, qualquer migration ficará restrita a ambiente local/teste; nenhuma migração de produção será executada sem autorização explícita.
- Resultados inconclusivos devem permanecer em revisão, e somente aprovação humana pode tornar um processo publicável.
