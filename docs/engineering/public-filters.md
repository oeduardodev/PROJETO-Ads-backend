# Facetas públicas

`GET /api/v1/filters` oferece UF, modalidade, tipo de seleção e ENEM (`true`, `false`, `unknown`). A consulta base considera apenas processos `PUBLICADO`, não históricos de demonstração, de instituição pública verificada, fora do SiSU regular e com gratuidade confirmada. O processo histórico UFPB-12 da seed permanece `RASCUNHO` e não aparece. UF é derivada apenas de campi verificados; quando não houver campus verificado, a faceta pode trazer `UNKNOWN`.

Cada valor de faceta conta **processos distintos**, mesmo quando um processo possui várias ofertas do mesmo valor. `total` também conta processos, não ofertas. Por decisão do ADR 0012, todos os filtros ativos se aplicam a todas as facetas, inclusive à própria faceta. UF e modalidade devem corresponder à mesma oferta. Um processo com valores diferentes em várias ofertas pode contribuir para mais de um valor; a soma das contagens não precisa ser igual ao total. Os testes de integração usam processos sintéticos dentro de transação revertida; nenhuma oportunidade de teste fica publicada.

O cálculo atual lê campos mínimos dos processos elegíveis e agrega em memória. É adequado para validar o contrato do piloto; uma otimização SQL com métricas de volume real poderá ser necessária antes de ampliação de cobertura.
