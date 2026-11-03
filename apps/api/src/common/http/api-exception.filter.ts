import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type HttpResponse = {
  setHeader(name: string, value: string): HttpResponse;
  status(code: number): HttpResponse;
  json(value: unknown): void;
};

function errorCode(status: number): string {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 404) return 'NOT_FOUND';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return `HTTP_${status}`;
}

function publicMessage(status: number): string {
  if (status === 400) return 'Invalid request';
  if (status === 404) return 'Resource not found';
  if (status === 503) return 'Service unavailable';
  if (status >= 500) return 'Internal server error';
  return 'Request could not be completed';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && !(exception instanceof HttpException)) {
      const kind = exception instanceof Error ? exception.name : 'Unknown';
      this.logger.error(`Unhandled REST error: ${kind}`);
    }
    const requestId = randomUUID();
    response
      .setHeader('x-request-id', requestId)
      .status(status)
      .json({
        error: {
          code: errorCode(status),
          message: publicMessage(status),
          status,
          requestId,
        },
      });
  }
}
