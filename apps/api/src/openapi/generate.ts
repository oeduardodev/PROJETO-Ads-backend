import { NestFactory } from '@nestjs/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPublicOpenApi } from './public-openapi.js';

// Only metadata is generated. The client is never connected to this URL.
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@127.0.0.1:5433/openapi';

const { AppModule } = await import('../app.module.js');
const app = await NestFactory.create(AppModule, { logger: false });
try {
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
  const document = createPublicOpenApi(app);
  const content = `${JSON.stringify(document, null, 2)}\n`;
  const output = join(process.cwd(), 'apps', 'api', 'openapi', 'public-v1.json');
  if (process.argv.includes('--check')) {
    const committed = await readFile(output, 'utf8');
    if (committed !== content) throw new Error('OpenAPI artifact differs from NestJS metadata');
  } else {
    await mkdir(join(process.cwd(), 'apps', 'api', 'openapi'), { recursive: true });
    await writeFile(output, content, 'utf8');
  }
} finally {
  await app.close();
}
