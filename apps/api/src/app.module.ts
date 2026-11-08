import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { InstitutionsModule } from './modules/institutions/institutions.module.js';
import { CampusesModule } from './modules/campuses/campuses.module.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { AdminSourcesModule } from './modules/sources/admin-sources.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { CrawlingModule } from './modules/crawling/crawling.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExtractionModule } from './modules/extraction/extraction.module.js';
import { ValidationModule } from './modules/validation/validation.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { OfferingsModule } from './modules/offerings/offerings.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthzModule } from './modules/authz/authz.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    InstitutionsModule,
    CampusesModule,
    SourcesModule,
    AdminSourcesModule,
    DiscoveryModule,
    CrawlingModule,
    DocumentsModule,
    ExtractionModule,
    ValidationModule,
    ProcessesModule,
    OfferingsModule,
    ReviewsModule,
    SearchModule,
    AccountsModule,
    AlertsModule,
    AuditModule,
    AuthModule,
    AuthzModule,
  ],
})
export class AppModule {}
