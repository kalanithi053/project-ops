import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from 'src/types/apiResponse.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | StreamableFile> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    return next.handle().pipe(
      map((data: T) => {
        // A file download streams raw bytes — wrapping it in the JSON
        // envelope below would break the response entirely.
        if (data instanceof StreamableFile) return data;
        const payload =
          data && typeof data === 'object'
            ? (data as Record<string, unknown>)
            : undefined;
        const message =
          (payload?.message as string | undefined) ||
          'Request processed successfully';
        if (payload) delete payload.message;
        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
        };
      }),
    );
  }
}
