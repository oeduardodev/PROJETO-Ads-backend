# ADR 0001 — Limites do catálogo de graduação

- Estado: aceito conforme o escopo definido pelo usuário nos documentos de referência
- Referências: arquitetura §§ 1.1–1.3, 2.1, 5.4, 12.2, 13.1; roteiro §§ 1.2, 5 e passo 002

## Decisão

O catálogo público cobre processos seletivos para bacharelado, licenciatura ou curso superior de tecnologia **sem mensalidade**, oferecidos por instituições públicas federais ou estaduais e **fora do fluxo regular do SiSU**. A taxa de inscrição, se houver, é um dado separado da gratuidade do curso.

`regular_sisu_flow = false` é condição de inclusão. `requires_enem` é atributo independente, com valores `true`, `false` e `unknown`. Uma seleção própria pode usar nota do ENEM e continuar no catálogo. ENEM desconhecido não será convertido em `false`.

O MVP exclui curso técnico, ensino médio, pós-graduação, extensão, curso livre, instituição privada, graduação com mensalidade, vaga exclusiva do SiSU regular, ProUni e FIES. Transferência, reingresso, portador de diploma, histórico escolar e vagas remanescentes podem entrar quando todas as condições de escopo forem comprovadas.

O sistema mostra a URL institucional oficial, a origem e a última verificação. A inscrição ocorre somente no portal da instituição. Nenhum edital ou link será publicado sem fonte oficial verificável e decisão de revisão humana. Ausência ou conflito de prova para instituição, nível, gratuidade, fluxo SiSU, prazo, vagas ou requisitos leva a revisão e a exibição como não confirmado, nunca à invenção de valor. O edital oficial prevalece.

## Casos de aceite a automatizar nos passos de domínio e IA

Os exemplos abaixo são cenários sintéticos de teste, não oportunidades reais.

| Caso | Entrada resumida | Resultado esperado |
| --- | --- | --- |
| Positivo 1 | Universidade federal, bacharelado gratuito, vestibular próprio, sem ENEM, fonte oficial | Candidato ao catálogo após revisão; `requires_enem=false` |
| Positivo 2 | Universidade estadual, licenciatura gratuita, seleção própria por nota ENEM, fonte oficial | Candidato ao catálogo após revisão; `requires_enem=true`, `regular_sisu_flow=false` |
| Positivo 3 | Instituto federal, curso superior de tecnologia gratuito, vagas remanescentes, fonte oficial | Candidato ao catálogo após revisão; preservar campus, ofertas e reservas |
| Positivo 4 | Seleção por transferência para graduação gratuita, taxa de inscrição documentada | Candidato ao catálogo; não confundir taxa com mensalidade |
| Negativo 1 | Vagas exclusivamente pelo SiSU regular | Rejeitar do catálogo mesmo que a instituição seja pública |
| Negativo 2 | Curso técnico integrado ou subsequente | Rejeitar do MVP mesmo que o campus seja público |
| Negativo 3 | Pós-graduação, extensão ou curso livre | Rejeitar do MVP |
| Negativo 4 | Graduação em instituição privada, com bolsa | Rejeitar do catálogo |
| Negativo 5 | Graduação com mensalidade ou sem prova de gratuidade | Rejeitar se paga; se não comprovada, manter em revisão |
| Negativo 6 | Link enviado por usuário sem confirmação institucional | Apenas candidato à triagem; nunca publicar automaticamente |
| Incerto 1 | Edital oficial sem indicação conclusiva sobre uso do ENEM | `requires_enem=unknown`; revisar, sem inferir `false` |
| Incerto 2 | Prazo com apenas dia e mês, sem ano ou hora inequívocos | Marcar prazo não confirmado e revisar; não inventar 23h59 |

## Consequências

O modelo deverá suportar várias ofertas, campi, janelas e requisitos por processo. Estados de ingestão, publicação e inscrição serão separados. Filtros e cards públicos usarão somente registros publicados e verificados, com dados ausentes apresentados explicitamente.
