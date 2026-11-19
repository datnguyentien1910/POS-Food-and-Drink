import {
  BadRequestException,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../errors/app.exception.js';
import type { ApiErrorBody } from '../types/api.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Đã xảy ra lỗi hệ thống';
    let details: unknown;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof BadRequestException) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Dữ liệu không hợp lệ';
      const exceptionResponse = exception.getResponse();
      details =
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
          ? (exceptionResponse as { message: unknown }).message
          : undefined;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (status === HttpStatus.UNAUTHORIZED) {
        code = 'UNAUTHORIZED';
        message = 'Chưa đăng nhập hoặc phiên đã hết hạn';
      } else if (status === HttpStatus.FORBIDDEN) {
        code = 'FORBIDDEN';
        message = 'Bạn không có quyền thực hiện thao tác này';
      } else if (status === HttpStatus.NOT_FOUND) {
        code = 'NOT_FOUND';
        message = 'Không tìm thấy tài nguyên';
      } else {
        message = exception.message;
      }
    } else {
      this.logger.error(
        `Unhandled exception [requestId=${request.id ?? 'unknown'}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    };

    response.status(status).json(body);
  }
}
