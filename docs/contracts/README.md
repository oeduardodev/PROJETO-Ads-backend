# Contratos de saída semântica v1

`classification-v1.json` e `extraction-v1.json` são gerados das definições Zod
em `apps/api/src/modules/ai/schemas/`. Execute `corepack pnpm schemas:generate`
após alterar as definições; o teste verifica que os artefatos estão
sincronizados.

As propriedades são obrigatórias. Quando uma informação não estiver confirmada,
o valor deve ser `null`; listas desconhecidas também são `null`, enquanto uma
lista vazia significa que a fonte confirmou que não há itens para aquele campo.
Datas e horas de cada janela são separadas para preservar prazos parciais sem
completar horários ausentes.

O enum `selection_type` usa os doze códigos controlados em
`docs/domain/glossary.md`. `scope_decision` permanece separado e inclui
`PENDING_REVIEW` e `UNKNOWN`; nenhum desses valores autoriza publicação.

O JSON Schema estrutural não expressa a dependência entre valores preenchidos e
suas referências. A validação Zod também verifica que cada campo crítico não
nulo tem uma entrada em `evidence` com o caminho do campo, ID UUID do documento,
página/seção e trecho curto. Consumidores devem executar a validação Zod após a
validação estrutural, inclusive quando o provedor de IA restringir a saída pelo
JSON Schema.

`institution_id` é contexto de origem fornecido pelo pipeline; o modelo não
deve inferir nem substituir essa associação a partir do texto do edital.

Estes contratos não são o DTO público da API nem um prompt. Valores extraídos
continuam sujeitos a validação determinística e revisão humana conforme a
arquitetura.
