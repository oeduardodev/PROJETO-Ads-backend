# ADR 0031 — vínculo de campus na normalização

- Estado: PROPOSTO no passo 052; aguarda decisão do usuário.
- Data: 2026-11-07 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.3 e 6–6.1; roteiro 052; schema `ExtractionV1`; tabelas `campuses` e `offerings`.

## Contexto

O payload de IA informa nome de campus ou `null`, mas não traz cidade nem ID.
O cadastro permite nomes iguais em cidades diferentes de uma mesma instituição
e a oferta persiste `campus_id` opcional. Ligar pelo primeiro nome semelhante
associaria ofertas ao lugar errado. O nome de curso também pode ser `null` no
payload, enquanto a linha de oferta no banco exige `course_name`; a etapa de
normalização não deve inventar esse nome nem descartar outras ofertas.

## Alternativas

1. **Nome exato e único verificado (recomendada):** comparar a chave normalizada
   do nome extraído apenas com campi da mesma instituição que tenham
   `verified_at`. Vincular o ID somente quando houver uma correspondência
   única. Sem correspondência ou com homônimos, manter `campusId=null` e emitir
   pendência de revisão. Não inferir cidade ou curso.
2. **Somente ID fornecido por curador:** nunca vincular a partir do nome;
   guardar o nome extraído e exigir seleção manual do campus antes de persistir
   o vínculo. Reduz o risco de associação incorreta, mas cria mais trabalho
   mesmo quando o nome é único e já verificado.

## Decisão

Pendente quanto à associação automática pelo nome. O passo 052 implementa apenas
um vínculo explícito informado na entrada por `sourceIndex` e ID de campus já
verificado: exige mesma instituição e nome normalizado igual ao nome extraído.
Sem esse vínculo, `campusId=null` e o nome extraído continua disponível para
revisão. A normalização preserva valores originais, ofertas, reservas, requisitos
e IDs de documento. Oferta com curso desconhecido permanece em rascunho
estruturado e não é escrita na tabela `offerings` até revisão.
