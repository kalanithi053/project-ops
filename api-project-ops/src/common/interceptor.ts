import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from 'src/types/apiResponse.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx?.getResponse();
    return next.handle().pipe(
      map((data: any) => {
        const message = data?.message || 'Request processed successfully';
        delete data?.message;
        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data: data,
        };
      }),
    );
  }
}
