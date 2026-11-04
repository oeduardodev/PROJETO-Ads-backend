# Estados de prazo — passo 028

O cálculo em `deadlines/deadline-state.ts` usa data civil, hora e fuso da janela. Cada extremidade deve ser completa e corresponder a um instante não ambíguo; transição de horário de verão com hora repetida/inexistente e intervalo invertido resultam em `UNKNOWN`. A janela é aberta em `[início, fim)`: exatamente no início está aberta; exatamente no fim está encerrada. Data final sem hora não recebe 23h59 implícito.

A função interna produz `OPEN`, `CLOSED`, `UPCOMING` ou `UNKNOWN`. A API traduz para `ABERTA`, `ENCERRADA`, `PREVISTA` e `INDETERMINADA`, conforme a arquitetura e o glossário. `SUSPENSA` exige aviso oficial de suspensão e não pode ser inferida das datas atuais.

O estado agregado de várias janelas segue o ADR 0015 aceito pelo usuário: uma janela completa aberta prevalece; sem aberta, uma janela parcial torna o resultado indeterminado; sem parciais, uma janela futura torna o resultado previsto; todas completas e encerradas tornam o processo encerrado. Nenhuma janela resulta em indeterminado. `open_only=true` continua exigindo uma janela completa aberta, como decidido no ADR 0013.
