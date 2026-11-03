import { Module } from '@nestjs/common';
import { DiscoveredUrlsRepository } from './discovered-urls.repository.js';

@Module({ providers: [DiscoveredUrlsRepository], exports: [DiscoveredUrlsRepository] })
export class DiscoveryModule {}
