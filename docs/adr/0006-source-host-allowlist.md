# ADR 0006 — alcance da allowlist de hosts de fontes

- Estado: ACEITO; decisão explícita do usuário no passo 016.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 1, 4.1–4.2, 6 e 7; roteiro 016.

## Contexto

Cada instituição pode ter várias fontes e domínios autorizados. A arquitetura não determina se cadastrar um host como `www.prg.ufpb.br` autoriza automaticamente subdomínios. Essa escolha afeta a validação de URLs, o limite da coleta futura e a revisão de novos hosts. A matriz de pesquisa registra hosts observados, mas ainda não aprova crawling nem retenção.

## Alternativas

1. **Host exato:** a URL de uma fonte só é aceita quando seu host normalizado coincide com um registro da allowlist da mesma instituição. Outro subdomínio exige cadastro e revisão próprios. É a proposta conservadora.
2. **Host e subdomínios:** um registro autoriza o host e qualquer descendente DNS. Reduz cadastros, mas amplia automaticamente a superfície de coleta para hosts não revisados.

## Decisão e consequências

Decisão: alternativa 1, host exato. A allowlist serve apenas para validar cadastro, sem autorizar coleta. Registros de domínio e de fonte começam desabilitados ou em rascunho. Ativar coleta dependerá de revisão de acesso, licença e retenção por fonte. Rejeitar URL com IP literal, host local, credenciais embutidas, protocolo não HTTPS ou porta não padrão. A escolha foi confirmada antes da migration 016.

A validação no cadastro não substitui a resolução DNS segura no momento de cada requisição: o coletor futuro terá de rejeitar endereços privados/loopback após resolver o host e após redirecionamentos. Nenhum coletor é ativado neste passo.
