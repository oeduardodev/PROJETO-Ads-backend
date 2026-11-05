# Política inicial de descoberta de fontes — piloto Paraíba

Estado: pesquisa manual concluída em 2026-11-02; coleta automatizada **não habilitada**.

Referências: arquitetura §§ 4.1–4.3, 10.1, 13 e 15; roteiro passo 003. A matriz `source-matrix.csv` é o inventário operacional desta pesquisa. As URLs foram abertas diretamente por HTTPS e responderam HTTP 200 nesta data. Isso confirma a existência da listagem, não a elegibilidade de cada edital nem a permissão para coletar em escala.

## Fontes e método de descoberta

- UFPB: [índice da PRG](https://www.prg.ufpb.br/editais/ingressantes/) separa formas de ingresso e também lista SiSU/SiSU+, que devem ser excluídos. A [Subcoordenação de Admissão](https://www.prg.ufpb.br/contato/) publica contato institucional.
- UFCG: [categoria de graduação da COMPROV](https://comprov.ufcg.edu.br/graduacao.html) lista vestibulares próprios, ingressos derivados e vagas remanescentes ao lado de SiSU. O [contato da COMPROV](https://comprov.ufcg.edu.br/noticias.html) contém telefone. O título da categoria não prova escopo do edital.
- UEPB: [página de processos seletivos da PROGRAD](https://uepb.edu.br/prograd/processos-seletivos/) reúne categorias e documentos, incluindo retificações. A [página de contato](https://uepb.edu.br/prograd/contato/) indica o setor de Seleções. A ferramenta de busca retornou 502 ao abrir a página, mas a requisição HTTPS direta respondeu 200; o conector futuro deve tratar falhas transitórias.
- IFPB: [Portal do Estudante — editais](https://estudante.ifpb.edu.br/editais/) mistura graduação, técnico, especialização e SiSU. A [PRE descreve PSE/PSD/PSCS](https://www.ifpb.edu.br/pro-reitoria/pre/educacao-superior/processos-seletivos-1); conferir cada edital antes de incluí-lo. O [contato institucional](https://www.ifpb.edu.br/institucional/contato) publica `pre@ifpb.edu.br`.

O método inicial é listar links públicos em HTML com origem, URL canônica e data de descoberta; seguir somente páginas e documentos no host explicitamente autorizado da fonte. Notícias ou motores de busca podem sugerir candidatos, mas a confirmação deve ocorrer no edital oficial. Não considerar o título ou a categoria como prova de graduação gratuita fora do SiSU. Guardar edital principal, anexos e retificações como itens distintos nos passos de ingestão.

## Acesso e direitos observados

| Host | `robots.txt` em 2026-11-02 | Encaminhamento |
| --- | --- | --- |
| `www.prg.ufpb.br` | 404 | Sem diretiva publicada nesse host; revisar termos e confirmar política de acesso antes de automatizar. |
| `comprov.ufcg.edu.br` | 200; bloqueia caminhos administrativos/internos do Joomla | Não acessar caminhos bloqueados. O site declara [CC BY-ND 3.0](https://comprov.ufcg.edu.br/graduacao.html); avaliar licença/retensão antes de guardar snapshots ou PDFs. |
| `uepb.edu.br` | 403 | Manter pesquisa manual e esclarecer política antes de habilitar crawler. Não tratar o 403 como autorização. |
| `estudante.ifpb.edu.br` | 404 | Sem diretiva publicada nesse host; revisar termos antes de automatizar. O `robots.txt` de `www.ifpb.edu.br` é específico daquele outro host. |

Não foram enviados e-mails nem foi solicitado acesso às instituições. Os contatos na matriz são canais oficiais para esclarecer política, não evidência de autorização. Páginas públicas responderem 200 não resolve condições de reprodução ou retenção de documentos.

## Controles para o conector futuro

1. Revalidar `robots.txt`, termos, licença e URL antes de ativar cada fonte; registrar decisão e data. Respeitar bloqueios, autenticação e CAPTCHA sem contorno. Pausar em 403/429 e rever a fonte.
2. Usar allowlist por **host exato**, protocolos HTTP(S), validação de DNS/IP e de cada redirecionamento para evitar SSRF. Não seguir hosts novos automaticamente, mesmo sob o mesmo domínio institucional.
3. Começar com intervalo proposto de 24 horas para fontes prioritárias, conforme arquitetura § 4.2; o valor não afirma frequência oficial nem garante atualização em tempo real. Aplicar baixa concorrência por host, cache condicional ETag/Last-Modified e backoff para 429/5xx.
4. Medir hash e mudança antes de enfileirar extração. Registrar origem, horário, status HTTP, erro e última verificação. Reexecutar com fixtures offline nos passos posteriores.
5. Não versionar PDFs integrais sem licença ou autorização de retenção. Armazenar somente snapshots permitidos, com política de expiração a definir. O link oficial prevalece no catálogo.
6. Nenhum candidato desta pesquisa vira dado público automaticamente. Publicação exige prova por campo crítico, revisão humana e decisão auditável, conforme ADR 0001 e ADR 0002.

## Passo 038 — adapters offline UFPB/UFCG

Os adapters em `apps/api/src/modules/discovery/connectors/` usam as duas URLs e hosts exatos desta matriz, mas permanecem em `DRAFT` com `collectionAllowed=false` e `PENDING_REVIEW`. O seletor `a[href]` aciona o parser HTML genérico apenas sobre HTML fornecido localmente; não há fetch, agendamento ou ativação. Fixtures versionadas são harnesses sintéticos com URLs já registradas no manifesto/corpus, não snapshots nem transcrições dos sites. UFPB continua sem allowlist para `drive.ufpb.br`; links desse host ficam excluídos até revisão própria. UFCG mantém a pendência de licença/retenção.

## Pendências antes da automação

- Esclarecer o 403 em `uepb.edu.br/robots.txt` e os termos específicos de cada host.
- Definir política de retenção de HTML/PDF e licença por fonte antes do passo 041.
- Montar o corpus manual de 30–50 documentos oficiais com rotulagem no passo 004; não tomar estas listagens como cobertura completa.
