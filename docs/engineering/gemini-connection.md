# Gemini local

O adaptador Gemini usa `LLM_PROVIDER_KEY` do `.env` local e o modelo `gemini-3.5-flash-lite`. A chave não deve ser versionada nem enviada ao navegador. Para verificar a conexão sem mostrar a chave:

```powershell
corepack pnpm build
node --env-file=.env scripts/check-gemini.mjs
```

O teste faz uma única chamada pequena e confirma uma resposta JSON com contagem de tokens. O adaptador rejeita respostas inválidas e falha sem registrar o corpo retornado pela API.

O endpoint `/api/v1/official-feed` consulta a cada 12 horas as páginas de seleção já confirmadas da UFPB, UFCG e IFPB e a API pública de busca do site da UEPB. Ele lê somente links observados nessas fontes e pede ao Gemini para selecionar os relevantes para formas alternativas de ingresso na graduação. IDs inexistentes e URLs fora dos domínios oficiais são descartados. A última lista válida fica em `.cache/official-feed.json`, fora do Git; falhas preservam a lista anterior. A interface `/oportunidades` consome esse endpoint e mantém seus links conhecidos como alternativa quando a API está indisponível. Não há aprovação manual nesse fluxo de links.

Isso atualiza links de páginas oficiais, não extrai vagas, prazos ou requisitos dos editais e não cria `SelectionProcess` no banco. O worker legado de documentos continua bloqueado para captura oficial; o cadastro nacional de 317 instituições ainda tem endereço de seleção confirmado apenas para quatro. A página da UEPB retornou HTTP 403 para `robots.txt` no ensaio local; por isso sua coleta usa a API JSON pública do próprio site, sem raspar a página. Para ampliar a cobertura, cada novo portal precisa de um endereço institucional verificável. `AI_MAX_TOKENS_PER_DOCUMENT=0` continua reservado ao worker legado e não controla esse feed de links.

Links diretos para PDFs podem entrar como candidatos quando forem expostos por uma página, feed ou API oficial acessível. O Gemini interpreta os candidatos, mas não descobre URLs sozinho. A ferramenta Google Search Grounding não serve para montar o catálogo: os [termos atuais da API](https://aistudio.google.com/docs/terms#grounding-with-google-search) proíbem coletar links da resposta para criar um índice ou escolher páginas para crawling. O contexto de URL do Gemini pode analisar um PDF já conhecido, mas não encontra editais novos por conta própria. Para cada instituição, prefira API pública, RSS ou sitemap; respeite a política de acesso da fonte e registre quando ela foi consultada.
