import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { InstitutionsModule } from '../modules/institutions/institutions.module.js';
import { ProcessesModule } from '../modules/processes/processes.module.js';
import { publicSchemas } from './public-schemas.js';

export function createPublicOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Além do SiSU — API pública')
    .setDescription('Catálogo público revisado; versão 1 do contrato REST.')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    include: [InstitutionsModule, ProcessesModule],
    deepScanRoutes: true,
  });
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...publicSchemas };
  return document;
}

export function exposePublicOpenApi(app: INestApplication): void {
  SwaggerModule.setup('api/v1/docs', app, () => createPublicOpenApi(app), {
    jsonDocumentUrl: 'api/v1/openapi.json',
  });
}
