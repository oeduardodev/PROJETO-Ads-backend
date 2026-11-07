# ADR 0029 — unidade do orçamento de IA por documento

- Estado: ACEITO no passo 049, por decisão do usuário.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.1, 5.2, 7.1, 10.1 e 11.2; roteiro 049; ADR 0004.

## Contexto

O passo 049 pede timeouts, retries, orçamento por documento, token usage e
mocks offline. A arquitetura pede medir custo de IA, mas não define fornecedor,
unidade do orçamento, persistência nem replays contabilizados. O ADR 0004
estabelece que `LLM_PROVIDER_KEY` só é exigida quando um conector concreto for
ativado. Ainda não existe provider de IA selecionado ou ativo.

## Alternativas

1. **Orçamento cumulativo em tokens (escolhida):** medir tokens de entrada e
   saída reportados pelo adapter, acumular por documento com IDs de requisição
   idempotentes em Redis e aplicar limite configurável por documento. Limite
   zero desativa chamadas externas. Os testes usam provider fixture sem segredo;
   o protocolo permanece independente de fornecedor e não ativa um connector
   externo.
2. **Orçamento monetário por fornecedor:** selecionar fornecedor/modelo e
   contabilizar custo reportado em ledger persistente. Permite expressar um
   teto financeiro, mas requer decidir fornecedor, fonte de preços, moeda,
   reconciliação de preço e retenção do ledger antes de ativar chamadas.

## Decisão

O usuário escolheu tokens cumulativos por documento, persistidos em Redis; o
limite zero desativa chamadas externas. Não foi escolhido fornecedor. `LLM_PROVIDER_KEY`
continua exigida somente quando um conector concreto for ativado, conforme ADR 0004. Fixtures permanecem locais e podem rodar sem chave.

Para não exceder o teto enquanto o provedor ainda não está escolhido, cada
requisição externa informa um limite superior de tokens de entrada e de saída
por tentativa. Antes de chamar o provider, o worker reserva atomicamente a soma
desses limites para todas as tentativas configuradas. Após sucesso, Redis
reconcilia a reserva para os tokens reportados na tentativa final, mantendo a
reserva máxima das tentativas anteriores cujo consumo não foi informado. Se
falhar sem uso verificável, a reserva é mantida como consumo conservador. Um
`requestId` estável só pode reservar uma vez por documento, incluindo retries e
replays. Reservas não expiram; indisponibilidade do Redis fecha chamadas
externas. O contador não é diário e acompanha o documento.

O limite configurável do worker é `AI_MAX_TOKENS_PER_DOCUMENT`, inteiro seguro
não negativo, padrão `0`. `0` impede a chamada antes de alcançar o provider. A
escolha do fornecedor concreto e o método exato de tokenização permanecem fora
deste passo; quando um conector for introduzido, ele deve garantir que o limite
de entrada informado cobre a requisição efetivamente enviada e validar sua
credencial na inicialização.
