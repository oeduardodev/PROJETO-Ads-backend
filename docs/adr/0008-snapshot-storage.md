# ADR 0008 — storage e identidade de snapshots

- Estado: ACEITO; decisão explícita do usuário no passo 018.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 3.1, 4.2, 6 e 10.1; roteiro 018; `docs/research/crawl-policy.md`.

## Contexto

O roteiro exige hash SHA-256, MIME, versão, captura, URL e `storage_key`, sem escolher provedor de storage ou prazo de retenção. A pesquisa já alerta que resposta HTTP pública não comprova licença de reprodução ou retenção. Não há aprovação por fonte para guardar PDFs integrais.

## Alternativas

1. **Metadados versionados e storage local só para testes autorizados:** criar contrato de storage, deduplicar bytes por hash e registrar versões por URL. O adaptador local aceita apenas fixtures sintéticas do teste; snapshots de fontes oficiais ficam bloqueados até política de licença/retenção por fonte. Produção aguarda escolha de provedor e credenciais. É a proposta.
2. **S3 compatível já no passo 018:** introduzir bucket, configuração e retenção agora. Ainda exigiria decisão de permissão por fonte e poderia criar custo/infraestrutura sem corpus autorizado.

## Decisão e consequências

Decisão: alternativa 1. A identidade do conteúdo é global pelo SHA-256; a versão é sequencial por URL canônica. O mesmo conteúdo em URLs diferentes referencia o mesmo blob, mas mantém documentos de origem distintos. O adaptador local aceita apenas fixtures sintéticas sob `NODE_ENV=test`. Nenhum PDF oficial será copiado neste passo. A escolha foi confirmada antes da migration 018.
