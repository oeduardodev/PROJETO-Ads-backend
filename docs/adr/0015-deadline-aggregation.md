# ADR 0015 — estado agregado de inscrições

- Estado: ACEITO; escolha explícita do usuário no passo 028.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.4, 6.2, 8 e 12; roteiro 028; ADR 0013.

## Contexto

O roteiro pede `OPEN`, `CLOSED`, `UPCOMING` e `UNKNOWN`, mas não define como condensar várias janelas do mesmo processo quando uma delas tem hora ou fuso incompleto. A arquitetura proíbe tratar prazo ambíguo como aberto e menciona “verificar prazo”. O passo 026 já usa uma janela completa aberta para `open_only`.

## Alternativas

1. **Conservadora:** qualquer janela completa aberta resulta em `OPEN`; se não houver aberta, qualquer janela parcial ou ambígua resulta em `UNKNOWN`; somente janelas completas e futuras resultam em `UPCOMING`; todas completas e encerradas resultam em `CLOSED`. Nenhuma janela resulta em `UNKNOWN`. É a proposta.
2. Mostrar `UPCOMING` quando existir janela futura completa mesmo com outra ambígua; isso pode ocultar uma abertura atual não confirmada.

## Decisão e consequências

O usuário escolheu a alternativa 1. Uma janela completa aberta prevalece. Sem janela aberta, qualquer prazo parcial ou ambíguo torna o processo `UNKNOWN`; caso contrário, um prazo futuro completo torna o processo `UPCOMING`, e todos os prazos completos encerrados tornam o processo `CLOSED`. Sem janelas, o estado é `UNKNOWN`. Cada janela completa é calculada com data civil, hora e fuso; instantes repetidos ou inexistentes por transição de fuso retornam `UNKNOWN`. Não se presume 23h59.

Os nomes `OPEN/CLOSED/UPCOMING/UNKNOWN` pertencem à função interna solicitada no roteiro. O contrato público usa `ABERTA/ENCERRADA/PREVISTA/INDETERMINADA`, conforme a arquitetura § 6.2, o exemplo § 8.1 e o glossário existente. Não há estado `SUSPENSA` derivável do schema atual; tal estado exige aviso oficial e revisão explícita.
