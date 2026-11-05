# ADR 0027 — cache de parser e retenção de snapshots

- Estado: ACEITO; escolha explícita do usuário no passo 046.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.2, 5.2 e 10.1; roteiro 046; ADRs 0008 e 0026.

## Contexto

O passo 046 pede evitar extração repetida pela identidade hash + versão do
parser, expirar snapshots quando permitido e preservar metadados/evidências. A
arquitetura exige política de retenção e a revisão do ADR 0008 bloqueia cópias
oficiais até decisão por fonte. Ainda não há resultado de parser persistido nem
configuração de retenção por fonte. O resultado reutilizável contém texto e
estrutura extraídos, portanto também precisa obedecer à retenção.

## Alternativas

1. **Cache estruturado e expiração opt-in por fonte (recomendada):** persistir
   o resultado JSON do parser em PostgreSQL, chaveado por SHA-256, tipo e versão
   do parser. A fonte pode receber um prazo positivo somente junto de uma
   revisão explícita de retenção; valor nulo ou ausência de revisão desativa a
   expiração automática. Para blobs compartilhados, expirar bytes e cache apenas
   quando todos os documentos/fontes associados forem elegíveis e seus prazos
   tiverem vencido. Preservar documentos, hashes, procedência, relações e
   evidências editoriais.
2. **Cache de conclusão sem resultado:** guardar apenas que o parser já rodou.
   Evita algum trabalho, mas não permite reutilizar texto/estrutura e pode
   bloquear o fluxo seguinte sem artefato recuperável.
3. **Cache externo em object storage:** requer provedor e política de retenção
   adicional, que o ADR 0008 deixou para decisão futura.

## Decisão e consequências

A opção 1 permite reusar o mesmo resultado para snapshots com bytes idênticos e
parser inalterado. Mudanças no parser usam uma nova versão. Texto em cache é
conteúdo derivado e segue o mesmo vencimento do blob. Sem decisão de retenção
revisada para todas as origens associadas, o cleanup não remove bytes nem
resultado de parser. O storage de produção continua bloqueado pelo ADR 0008;
fixtures sintéticas locais podem validar cache e cleanup sem representar fontes
reais.

O prazo comum é calculado por associação fonte/documento, e o blob compartilhado
usa o maior prazo resultante. Uma origem sem revisão, documento sem observação
de proveniência ou associação sem prazo conserva o blob e todo o cache. A
limpeza não remove documentos, hashes, procedência, relações ou evidências.
Para evitar vencimento antecipado, cada associação conta o prazo desde a data
mais recente entre a captura do documento e a revisão da política. Execução
agendada e provedor de storage de produção exigem decisão operacional posterior.

## Decisão

Aceita pelo usuário no passo 046. Cache JSON fica chaveado por hash, tipo e
versão do parser. Prazo de retenção só habilita cleanup após revisão explícita
por fonte. Blobs compartilhados e resultados de parser só expiram quando todas
as origens associadas forem elegíveis; documentos, relações e evidências são
preservados.
