# Processos, ofertas e janelas

O passo 019 mantém cada processo ligado à instituição e cada oferta ligada a um curso e campus. Reservas são linhas filhas de ofertas; requisitos podem pertencer ao processo, à oferta ou à reserva. Uma janela pertence ao processo e pode se restringir a uma oferta. Assim vários cursos, campi, reservas e períodos não são achatados em um único registro.

Datas civis e horas opcionais são persistidas separadamente. Hora e fuso desconhecidos permanecem nulos; o sistema não infere 23h59. Vagas desconhecidas também permanecem nulas, enquanto vagas informadas não podem ser negativas. `regularSisuFlow` e `requiresEnem` preservam `null` quando não confirmados.

O modelo não publica processos nem calcula estado de inscrição. Evidências, retificações e decisões de revisão são escopo do passo 020; o estado de prazo será calculado no passo 028. Os testes de integração usam somente dados sintéticos e apagam seus registros.
