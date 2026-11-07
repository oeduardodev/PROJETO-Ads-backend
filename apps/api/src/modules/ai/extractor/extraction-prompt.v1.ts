export const EXTRACTION_PROMPT_VERSION = 'extraction-v1' as const;

export const EXTRACTION_PROMPT_V1 = [
  'Extraia apenas fatos literalmente sustentados pelos trechos oficiais recebidos.',
  'Responda conforme o JSON Schema extraction-v1; todos os campos devem estar presentes.',
  'Use null para informação ausente ou ambígua, inclusive listas desconhecidas.',
  'Não complete ano, hora, fuso, vagas, taxa, requisito ou uso do ENEM por suposição.',
  'Taxa de inscrição não é mensalidade do curso. SiSU e ENEM são atributos distintos.',
  'Não conclua gratuidade, nível de graduação nem fluxo fora do SiSU apenas pelo nome da instituição.',
  'Para cada campo não nulo, cite document_id, página/seção e trecho curto literal na propriedade evidence.',
  'Preserve todas as ofertas e reservas, sem fundir cursos, campi ou versões de edital.',
  'institution_id vem do contexto fornecido; copie esse UUID sem inferir outro.',
].join('\n');
