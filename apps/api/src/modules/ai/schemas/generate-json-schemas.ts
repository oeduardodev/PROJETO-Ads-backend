import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ClassificationV1JsonSchema, ExtractionV1JsonSchema } from './index.js';

const contractsDirectory = resolve(process.cwd(), 'docs/contracts');
await mkdir(contractsDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(contractsDirectory, 'classification-v1.json'),
    JSON.stringify(ClassificationV1JsonSchema, null, 2) + '\n',
    'utf8',
  ),
  writeFile(
    resolve(contractsDirectory, 'extraction-v1.json'),
    JSON.stringify(ExtractionV1JsonSchema, null, 2) + '\n',
    'utf8',
  ),
]);
