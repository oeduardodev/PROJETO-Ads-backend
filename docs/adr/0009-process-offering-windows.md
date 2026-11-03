# ADR 0009 — ofertas, reservas e precisão dos prazos

- Estado: ACEITO; decisão explícita do usuário no passo 019.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 1.2, 5.3–5.4, 6 e 6.2; roteiro 019; `docs/domain/glossary.md` e `docs/domain/state-machine.md`.

## Contexto

O processo pode ter vários cursos, campi, modalidades, reservas e janelas. O edital pode confirmar apenas a data, sem hora ou fuso. A arquitetura proíbe inferir 23h59, mas não fixa a representação no banco nem a relação entre janela e oferta.

## Alternativas

1. **Tabelas filhas e precisão explícita:** `offerings`, `offering_reservations`, `application_windows` e `requirements`; cada janela pertence ao processo e pode apontar para uma oferta. Guardar data civil e hora opcional separadas, mais fuso opcional. Ausência de hora permanece nula. É a proposta.
2. **JSON de reservas e timestamps:** menos tabelas, porém dificulta filtros/constraints por reserva e pode introduzir horário implícito em prazo apenas diário.

## Decisão e consequências

Decisão: alternativa 1. O estado da inscrição será derivado depois, não gravado como verdade. Vagas e datas desconhecidas ficam nulas. A escolha de `selection_type` não será inferida do código da fixture nem tornada enum de banco automaticamente; o processo pode permanecer sem tipo até evidência. A escolha foi confirmada antes da migration 019.
