# Registros de descoberta

O passo 017 persiste `crawl_runs`, `discovered_urls` e `discovery_observations`. `crawl_runs` guarda tentativa, início/fim, HTTP status, sucesso e erro classificado. O banco impede tentativas não positivas e estados terminais sem resultado coerente. Criar um registro **não inicia coleta**.

Pelos ADRs 0007 e 0022, uma URL canônica gera um único candidato global. Uma observação por candidato e `crawlRunId` preserva fonte e primeiro/último momento; replay da mesma execução não altera contadores nem timestamps. Uma nova execução incrementa `seen_count` do candidato uma vez. A FK composta impede associar uma observação a uma execução de outra fonte. O candidato começa em `CANDIDATE`, sem publicação. Pontuação preliminar é interna e limitada a 0–1; não prova elegibilidade.

A normalização sintática exige HTTPS, host DNS público, remove fragmento e conserva query string, pois parâmetros podem identificar documentos oficiais. A verificação do destino após DNS e redirecionamentos, a política de robots/licença e o fetch real pertencem a passos futuros. Nenhuma URL descoberta é tratada como oficial ou publicável apenas por existir nesta tabela.
