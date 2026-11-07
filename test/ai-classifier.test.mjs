import assert from 'node:assert/strict';
import test from 'node:test';
import { ScopeClassifier } from '../apps/api/dist/modules/ai/classifier/scope-classifier.js';
import { AiProviderService } from '../apps/api/dist/modules/ai/provider/ai-provider.service.js';

const documentId = '92758f58-28a7-41d1-8f8c-f816cf20e185';

function source(text, pageOrSection) {
  return { documentId, pageOrSection, text };
}

function verifiedFacts(undergraduateText = 'Oferta de bacharelado.') {
  return {
    institutionPublic: {
      value: true,
      evidence: source('Instituição pública federal.', 'instituição'),
    },
    undergraduate: { value: true, evidence: source(undergraduateText, 'oferta') },
    tuitionFree: { value: true, evidence: source('Curso sem mensalidade.', 'gratuidade') },
  };
}

function candidate(requestId, title, excerpts = [], facts) {
  return {
    documentId,
    requestId,
    title,
    excerpts: excerpts.map((text, index) => source(text, `trecho ${index + 1}`)),
    ...(facts ? { facts } : {}),
    maxInputTokens: 1_000,
    maxOutputTokens: 300,
  };
}

function cite(field, inputSource) {
  return {
    field,
    document_id: inputSource.documentId,
    page_or_section: inputSource.pageOrSection,
    excerpt: inputSource.text,
  };
}

function positiveOutput(input, requiresEnem = null) {
  const title = source(input.title, 'title');
  const evidence = [
    cite('scope_decision', title),
    cite('regular_sisu_flow', title),
    cite('institution_public', input.facts.institutionPublic.evidence),
    cite('undergraduate', input.facts.undergraduate.evidence),
    cite('tuition_free', input.facts.tuitionFree.evidence),
  ];
  if (requiresEnem !== null) {
    const item = input.excerpts.find((entry) => /ENEM/u.test(entry.text));
    assert.ok(item);
    evidence.push(cite('requires_enem', item));
  }
  return {
    schema_version: 1,
    scope_decision: 'IN_SCOPE',
    selection_type: null,
    regular_sisu_flow: false,
    requires_enem: requiresEnem,
    evidence,
  };
}

function classifierWithFixtures(outputs) {
  const requests = [];
  const provider = {
    kind: 'fixture',
    generate: async (request) => {
      requests.push(request);
      const output = outputs.get(request.requestId);
      assert.ok(output, `unexpected model call for ${request.requestId}`);
      return { output, usage: { inputTokens: 100, outputTokens: 50 } };
    },
  };
  const service = new AiProviderService(provider, {
    timeoutMs: 1_000,
    maxAttempts: 1,
    retryBaseMs: 0,
  });
  return { classifier: new ScopeClassifier(service), requests };
}

function precisionRecall(rows, label) {
  const truePositive = rows.filter((row) => row.expected === label && row.actual === label).length;
  const falsePositive = rows.filter((row) => row.expected !== label && row.actual === label).length;
  const falseNegative = rows.filter((row) => row.expected === label && row.actual !== label).length;
  return {
    precision: truePositive / (truePositive + falsePositive),
    recall: truePositive / (truePositive + falseNegative),
  };
}

test('synthetic scope matrix measures policy precision and recall without claiming corpus performance', async () => {
  const ownNoEnem = candidate(
    'own-no-enem',
    'Vestibular próprio para bacharelado',
    ['Não exige nota do ENEM.'],
    verifiedFacts(),
  );
  const ownEnem = candidate(
    'own-enem',
    'Vestibular próprio para licenciatura',
    ['A seleção utiliza nota do ENEM como critério de classificação.'],
    verifiedFacts('Oferta de licenciatura.'),
  );
  const registrationFee = candidate(
    'registration-fee',
    'Vestibular próprio para bacharelado',
    ['Taxa de inscrição de R$ 50,00; curso sem mensalidade.'],
    verifiedFacts(),
  );
  const technologist = candidate(
    'technologist',
    'Vestibular próprio para curso superior de tecnólogo',
    ['Inscrição no portal próprio da instituição.'],
    verifiedFacts('Oferta de curso superior de tecnologia.'),
  );
  const positiveCases = [ownNoEnem, ownEnem, registrationFee, technologist];
  const outputs = new Map(
    positiveCases.map((item) => [
      item.requestId,
      positiveOutput(item, item === ownNoEnem ? false : item === ownEnem ? true : null),
    ]),
  );
  const { classifier, requests } = classifierWithFixtures(outputs);
  const matrix = [
    ...positiveCases.map((input) => ({ input, expected: 'IN_SCOPE' })),
    {
      input: candidate('sisu-regular', 'Seleção SiSU regular para graduação'),
      expected: 'OUT_OF_SCOPE',
    },
    {
      input: candidate('sisu-plus', 'Etapa SiSU+ de seleção para graduação'),
      expected: 'OUT_OF_SCOPE',
    },
    {
      input: candidate('postgraduate', 'Processo seletivo de pós-graduação em mestrado'),
      expected: 'OUT_OF_SCOPE',
    },
    {
      input: candidate(
        'technical',
        'Processo seletivo para curso técnico integrado de nível médio',
      ),
      expected: 'OUT_OF_SCOPE',
    },
    {
      input: candidate('private', 'Vestibular próprio de instituição privada'),
      expected: 'OUT_OF_SCOPE',
    },
    {
      input: candidate('paid', 'Vestibular próprio para graduação com mensalidade'),
      expected: 'OUT_OF_SCOPE',
    },
    {
      input: candidate('sisu-mention', 'Menção ao SiSU sem fluxo definido'),
      expected: 'PENDING_REVIEW',
    },
    {
      input: candidate(
        'remnants',
        'Vestibular próprio para vagas remanescentes originadas no SiSU',
      ),
      expected: 'PENDING_REVIEW',
    },
    {
      input: candidate(
        'contradiction',
        'Vestibular próprio para bacharelado no fluxo regular do SiSU',
      ),
      expected: 'PENDING_REVIEW',
    },
  ];

  const results = [];
  for (const item of matrix) {
    const result = await classifier.classify(item.input);
    results.push({ expected: item.expected, actual: result.classification.scope_decision });
    assert.equal(result.classification.scope_decision, item.expected, item.input.requestId);
    if (item.expected === 'PENDING_REVIEW') assert.equal(result.route, 'NEEDS_REVIEW');
    if (item.expected === 'OUT_OF_SCOPE') assert.equal(result.route, 'RULES_EXCLUDED');
    if (item.input.requestId === 'sisu-plus') {
      assert.equal(result.classification.selection_type, 'SISU_PLUS');
    }
  }
  assert.deepEqual(precisionRecall(results, 'IN_SCOPE'), { precision: 1, recall: 1 });
  assert.deepEqual(precisionRecall(results, 'OUT_OF_SCOPE'), { precision: 1, recall: 1 });
  assert.equal(requests.length, positiveCases.length);
  assert.ok(requests.every((request) => request.schemaId === 'classification-v1'));
  assert.ok(requests.every((request) => request.input.title && request.input.excerpts));
});

test('uncertain private or paid mentions are reviewed, never discarded from snippets alone', async () => {
  const { classifier, requests } = classifierWithFixtures(new Map());
  for (const input of [
    candidate('private-context', 'Vestibular próprio para bacharelado', [
      'O texto menciona uma instituição privada parceira, sem dizer que ela oferece as vagas.',
    ]),
    candidate('paid-context', 'Vestibular próprio para bacharelado', [
      'O texto compara outro curso com mensalidade, sem ligar o pagamento à oferta.',
    ]),
  ]) {
    const result = await classifier.classify(input);
    assert.equal(result.classification.scope_decision, 'PENDING_REVIEW');
    assert.equal(result.route, 'NEEDS_REVIEW');
  }
  assert.equal(requests.length, 0);
});

test('unsupported model exclusion, fabricated citation, and missing scope facts go to review', async () => {
  const unsupported = candidate(
    'unsupported',
    'Vestibular próprio para bacharelado',
    [],
    verifiedFacts(),
  );
  const fabricated = candidate(
    'fabricated',
    'Vestibular próprio para bacharelado',
    [],
    verifiedFacts(),
  );
  const missingFacts = candidate('missing-facts', 'Vestibular próprio para bacharelado');
  const outputs = new Map([
    [unsupported.requestId, { ...positiveOutput(unsupported), scope_decision: 'OUT_OF_SCOPE' }],
    [
      fabricated.requestId,
      {
        ...positiveOutput(fabricated),
        evidence: [cite('scope_decision', source('Trecho inventado.', 'title'))],
      },
    ],
    [
      missingFacts.requestId,
      {
        schema_version: 1,
        scope_decision: 'IN_SCOPE',
        selection_type: null,
        regular_sisu_flow: false,
        requires_enem: null,
        evidence: [
          cite('scope_decision', source(missingFacts.title, 'title')),
          cite('regular_sisu_flow', source(missingFacts.title, 'title')),
        ],
      },
    ],
  ]);
  const { classifier, requests } = classifierWithFixtures(outputs);
  for (const input of [unsupported, fabricated, missingFacts]) {
    const result = await classifier.classify(input);
    assert.equal(result.classification.scope_decision, 'PENDING_REVIEW');
    assert.equal(result.route, 'NEEDS_REVIEW');
  }
  assert.equal(requests.length, 3);
});
