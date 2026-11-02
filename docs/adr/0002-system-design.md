# ADR 0002 — API modular, worker separado e catálogo persistido

- Estado: aceito conforme a arquitetura definida pelo usuário
- Referências: arquitetura §§ 3, 5.1–5.4, 6, 7, 8, 9, 10.3, 14.1; roteiro §§ 1.2, 6 e passo 002

## Decisão

- NestJS organiza API e domínio como monólito modular. Um processo worker separado compartilha regras de negócio com a API e executa descoberta, coleta, classificação, extração, validação e reprocessamento fora das requisições HTTP.
- Angular oferece busca, filtros, detalhes e, depois, curadoria administrativa. O navegador não raspa fontes oficiais e não recebe segredos de busca, IA ou storage.
- PostgreSQL é a fonte persistente de processos, documentos, evidências e decisões. Redis/BullMQ coordena jobs, retries e agendamentos; não é a fonte definitiva dos editais.
- A IA atua apenas na ingestão de documentos oficiais, produzindo saída estruturada sob schema versionado e evidência por campo crítico. Valores não comprovados ficam nulos ou pendentes. A busca pública consulta dados publicados pela API REST; uma falha do worker ou da IA não deve impedir a consulta.
- A publicação exige fonte oficial, verificações determinísticas e decisão humana auditável. A confiança do modelo não equivale a veracidade pública. Retificações preservam versões e podem devolver processos à revisão.
- A leitura do catálogo é anônima. Escrita administrativa exige autenticação, papéis e trilha de auditoria. Favoritos e alertas de estudantes pertencem a P1, não bloqueiam o MVP.

## Consequências

As fronteiras de módulos, contratos OpenAPI, filas idempotentes, migrations, evidências e testes serão construídos nos passos correspondentes. O backend e o frontend estão em repositórios distintos conforme ADR 0000. O estado de ingestão, o de publicação e o estado derivado de inscrição não serão combinados em um único campo.

## Decisões ainda abertas

Prisma versus TypeORM requer spike e ADR antes da migration inicial (§ 7.1; passo 014). O provedor de autenticação administrativa requer ADR antes da implementação (passo 058). A estratégia SSR/SSG/CSR requer spike e ADR no passo 074. Nenhum desses defaults do roteiro fica aprovado por este ADR.
