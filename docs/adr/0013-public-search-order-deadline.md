# ADR 0013 — busca pública, ordenação e filtro de prazo

- Estado: ACEITO; escolhas explícitas do usuário no passo 026.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.4, 6.2, 7–9 e 12; roteiro 026–028.

## Contexto

O passo 026 pede `open_only` e ordenação antes da função geral de estados do passo 028. A arquitetura proíbe presumir hora/fuso e exige fonte e revisão para dados públicos. O modelo ainda não possuía data de verificação do processo, necessária para o card.

## Decisão

O usuário escolheu: `open_only=true` encontra processo se **ao menos uma** janela completa, com data, hora e fuso em ambas as extremidades, está aberta no instante da consulta. Prazo parcial ou horário ambíguo não se torna aberto. O cálculo conservador do passo 026 será centralizado e ampliado no 028. `sort` aceita `recent` (padrão, verificação mais recente), `deadline` (próximo encerramento futuro confirmado) e `course` (primeiro nome normalizado de curso); ID desempata. Valor não reconhecido gera 400.

Adicionar `verified_at` ao processo e exigir estado `PUBLICADO`, evidência de revisão, URL de referência, tipo, instituição pública verificada, gratuidade e fluxo fora do SiSU para leitura pública. A API nunca publica por si; a política editorial completa virá no passo próprio.
