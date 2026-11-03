import { Controller, Get } from '@nestjs/common';
import { ReadinessService } from './readiness.service.js';

@Controller('ready')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  check() {
    return this.readiness.check();
  }
}
