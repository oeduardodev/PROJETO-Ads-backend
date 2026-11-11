import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { parsePagination } from '../../apps/api/dist/common/http/pagination.js';
import { parseSearchQuery } from '../../apps/api/dist/modules/processes/public-search/search-query.js';
import { PublicSearchService } from '../../apps/api/dist/modules/processes/public-search/public-search.service.js';

const databaseUrl = process.env.PERFORMANCE_DATABASE_URL;
if (!databaseUrl)
  throw new Error('Set PERFORMANCE_DATABASE_URL to the isolated local perf database');
const database = new URL(databaseUrl);
if (
  !['127.0.0.1', 'localhost', '::1'].includes(database.hostname) ||
  database.port !== '5433' ||
  database.pathname !== '/alem_perf'
) {
  throw new Error('Performance harness only accepts localhost:5433/alem_perf');
}

process.env.DATABASE_URL = databaseUrl;
const prisma = new PrismaService();

const seedStatements = [
  `INSERT INTO institutions (id,name,normalized_name,acronym,jurisdiction,public_flag,verified_at)
   SELECT md5('inst-'||g)::uuid,'Perf Institution '||g,'perf institution '||g,'P'||g,'FEDERAL',true,now()
   FROM generate_series(1,5) g`,
  `INSERT INTO allowed_domains (id,institution_id,host,evidence_url,reviewed_at,collection_allowed)
   SELECT md5('domain-'||g)::uuid,md5('inst-'||g)::uuid,'inst-'||g||'.example.com','https://inst-'||g||'.example.com/about',now(),false
   FROM generate_series(1,5) g`,
  `INSERT INTO sources (id,institution_id,allowed_domain_id,url,kind,status,health)
   SELECT md5('source-'||g)::uuid,md5('inst-'||g)::uuid,md5('domain-'||g)::uuid,'https://inst-'||g||'.example.com/notices','HTML_INDEX','ACTIVE','HEALTHY'
   FROM generate_series(1,5) g`,
  `INSERT INTO selection_processes (id,institution_id,notice_code,notice_year,selection_type,regular_sisu_flow,requires_enem,tuition_free,demo_historical,reference_url,verified_at,ingestion_state,publication_status)
   SELECT md5('process-'||g)::uuid,md5('inst-'||(((g-1)%5)+1))::uuid,'PERF-'||g,2026,'TRANSFER',false,(g%2=0),true,false,
          'https://inst-'||(((g-1)%5)+1)||'.example.com/notices/'||g,now(),'VERIFIED','PUBLICADO'
   FROM generate_series(1,2000) g`,
  `INSERT INTO offerings (id,process_id,institution_id,course_name,normalized_course_name,degree_type,modality)
   SELECT md5('offering-'||g)::uuid,md5('process-'||g)::uuid,md5('inst-'||(((g-1)%5)+1))::uuid,
          CASE WHEN g%4=0 THEN 'Computer Science' ELSE 'Biology' END,
          CASE WHEN g%4=0 THEN 'computer science' ELSE 'biology' END,'BACHELOR','ON_CAMPUS'
   FROM generate_series(1,2000) g`,
  `INSERT INTO review_decisions (id,process_id,reviewer_id,decision,reason)
   SELECT md5('review-'||g)::uuid,md5('process-'||g)::uuid,'synthetic-perf','APPROVE','Synthetic performance fixture'
   FROM generate_series(1,2000) g`,
];

const representativeExplain = `
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT p.id
FROM selection_processes p
JOIN institutions i ON i.id = p.institution_id
WHERE p.publication_status = 'PUBLICADO'
  AND p.demo_historical = false
  AND p.regular_sisu_flow = false
  AND p.tuition_free = true
  AND p.reference_url IS NOT NULL
  AND p.selection_type IS NOT NULL
  AND p.verified_at IS NOT NULL
  AND i.public_flag = true
  AND i.verified_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM sources s JOIN allowed_domains d ON d.id = s.allowed_domain_id
    WHERE s.institution_id = i.id AND s.status = 'ACTIVE' AND d.reviewed_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1 FROM review_decisions r WHERE r.process_id = p.id AND r.decision = 'APPROVE'
  )`;

try {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS count FROM selection_processes`,
  );
  if (existing[0].count === 0) {
    await prisma.$transaction(async (tx) => {
      for (const statement of seedStatements) await tx.$executeRawUnsafe(statement);
      await tx.$executeRawUnsafe('ANALYZE');
    });
  } else if (existing[0].count !== 2000) {
    throw new Error(`Expected an empty or 2,000-row perf database; found ${existing[0].count}`);
  }

  const countRows = await prisma.$queryRawUnsafe(`
    SELECT (SELECT count(*)::int FROM selection_processes) AS processes,
           (SELECT count(*)::int FROM offerings) AS offerings,
           (SELECT count(*)::int FROM review_decisions) AS reviews`);
  if (
    countRows[0].processes !== 2000 ||
    countRows[0].offerings !== 2000 ||
    countRows[0].reviews !== 2000
  ) {
    throw new Error('Perf database contents do not match the synthetic reference dataset');
  }

  const explain = await prisma.$queryRawUnsafe(representativeExplain);
  const explainRoot =
    typeof explain[0]['QUERY PLAN'] === 'string'
      ? JSON.parse(explain[0]['QUERY PLAN'])[0]
      : explain[0]['QUERY PLAN'][0];
  const queryPlan = explainRoot.Plan;
  const search = new PublicSearchService(prisma);
  const query = parseSearchQuery({});
  const pagination = parsePagination({ page_size: '20' });
  for (let i = 0; i < 30; i += 1) await search.search(query, pagination);

  const samples = [];
  for (let batch = 0; batch < 25; batch += 1) {
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const started = performance.now();
        await search.search(query, pagination);
        return performance.now() - started;
      }),
    );
    samples.push(...concurrent);
  }
  samples.sort((a, b) => a - b);
  const percentile = (fraction) =>
    Number(samples[Math.ceil(fraction * samples.length) - 1].toFixed(2));
  const last = await search.search(query, pagination);
  if (last.meta.total !== 2000 || last.data.length !== 20)
    throw new Error('Search result/pagination mismatch');
  console.log(
    JSON.stringify(
      {
        dataset: countRows[0],
        warmup: 30,
        samples: samples.length,
        concurrency: 8,
        pageSize: 20,
        p50_ms: percentile(0.5),
        p95_ms: percentile(0.95),
        max_ms: Number(samples.at(-1).toFixed(2)),
        dbExecution_ms: explainRoot['Execution Time'],
        dbPlan: queryPlan['Node Type'],
        dbSharedBuffers: queryPlan['Shared Hit Blocks'] + queryPlan['Shared Read Blocks'],
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
