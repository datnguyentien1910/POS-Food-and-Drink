import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import type { Observable } from 'rxjs';
import { AppException } from '../common/errors/app.exception.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function uploadRootDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return configured ? configured : path.join(process.cwd(), 'uploads');
}

export function menuUploadDir(): string {
  return path.join(uploadRootDir(), 'menu');
}

type UploadOptions = NonNullable<Parameters<typeof FileInterceptor>[1]>;

export const menuUploadOptions: UploadOptions = {
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      const dir = menuUploadDir();
      mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${EXTENSION_BY_MIME[file.mimetype]}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_request, file, callback) => {
    if (!EXTENSION_BY_MIME[file.mimetype]) {
      callback(
        new AppException(
          400,
          'IMAGE_INVALID_TYPE',
          'Chỉ nhận ảnh JPEG, PNG hoặc WebP',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

@Injectable()
export class MenuImageUploadInterceptor implements NestInterceptor {
  private readonly upload = new (FileInterceptor('file', menuUploadOptions))();

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return await this.upload.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new AppException(
          400,
          'IMAGE_TOO_LARGE',
          'Ảnh vượt quá dung lượng 2 MB',
        );
      }
      throw error;
    }
  }
}
