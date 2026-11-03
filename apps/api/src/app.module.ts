import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { InstitutionsModule } from './modules/institutions/institutions.module.js';
import { CampusesModule } from './modules/campuses/campuses.module.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { CrawlingModule } from './modules/crawling/crawling.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExtractionModule } from './modules/extraction/extraction.module.js';
import { ValidationModule } from './modules/validation/validation.module.js';
import { SelectionProcessesModule } from './modules/selection-processes/selection-processes.module.js';
import { OfferingsModule } from './modules/offerings/offerings.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

@Module({
  imports: [
    HealthModule,
    InstitutionsModule,
    CampusesModule,
    SourcesModule,
    DiscoveryModule,
    CrawlingModule,
    DocumentsModule,
    ExtractionModule,
    ValidationModule,
    SelectionProcessesModule,
    OfferingsModule,
    ReviewsModule,
    SearchModule,
    AccountsModule,
    AlertsModule,
    AuditModule,
  ],
})
export class AppModule {}
