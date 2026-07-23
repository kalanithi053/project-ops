import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  constructor() {}
  async catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const body = exception.getResponse() as any;
    const message = body?.message || 'An error occurred';

    this.logger.error(
      `[${request.method}] ${request.url} - ${status} | ${message} ${JSON.stringify(body?.errors)}`,
      exception.stack,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors: body?.errors || [],
    });
  }
}
