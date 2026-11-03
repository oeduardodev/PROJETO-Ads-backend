# Saúde, prontidão e erros REST

`GET /health` indica que o processo HTTP está vivo. `GET /ready` consulta PostgreSQL (`SELECT 1`) e Redis (`PING`); responde 200 somente quando ambos estão disponíveis. Falhas geram 503 genérico ao cliente e log estruturado por componente com código/nome do erro, sem imprimir credenciais ou URL de conexão. O probe Redis usa cliente com timeout e sem reconexão automática por requisição.

O filtro global devolve `{ "error": { "code", "message", "status", "requestId" } }` e cabeçalho `x-request-id`. Mensagens 4xx/5xx são fixas e não repetem dados de exceções internas. `parsePagination` fornece `page=1` e `page_size=20` por padrão, com limites de 10000 páginas e 100 itens por página; parâmetros fora da faixa produzem 400. As listagens usarão esse utilitário nos próximos passos.

O teste E2E confere 404 e 503 sem dados sensíveis. A integração usa PostgreSQL/Redis locais e simula a falha de cada dependência separadamente. Nenhuma chamada de IA ou crawler faz parte da prontidão da API pública.
