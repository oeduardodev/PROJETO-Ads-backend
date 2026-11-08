# ADR 0034 — visibilidade após retificação crítica

- Estado: PROPOSTO no passo 055; aguarda decisão do usuário.
- Data: 2026-11-08 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.4 e 6.2; roteiro 055; máquina de estados do passo 005.

## Contexto

O roteiro pede invalidar publicação quando uma retificação muda prazo ou
requisito crítico sem confirmação. A máquina de estados documentada exige
decisão editorial auditável e diz que falhas da IA/fonte não ocultam por si só
um processo publicado. Uma retificação oficial confirmada é diferente de
falha de coleta, mas ainda falta política explícita para a transição de
visibilidade.

## Alternativas

1. Ocultar automaticamente o processo publicado ao detectar mudança crítica
   confirmada em documento oficial, registrar evento auditável e exigir nova
   aprovação humana para republicar.
2. Manter a versão pública anterior visível com alerta interno até decisão do
   curador, sem trocar campos públicos antes da revisão.

## Decisão provisória para o passo 055

O planejador calcula diferenças, preserva as versões anterior e candidata e
marca `requiresReview`/`blocksCurrentPublication` para mudança crítica. Não
altera `publication_status` nem substitui campos públicos enquanto a política
aguarda decisão. O serviço que aplicará a transição deve ser atômico e
auditável. Nenhuma retificação é publicada automaticamente.
