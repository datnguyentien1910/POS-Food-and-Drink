import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { Paginated, type ApiEnvelope } from '../types/api.js';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((value) => {
        if (value instanceof Paginated) {
          return { data: value.data as T, meta: value.meta };
        }
        return { data: (value ?? null) as T };
      }),
    );
  }
}
