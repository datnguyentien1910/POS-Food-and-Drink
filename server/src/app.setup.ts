import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { parseOrigins } from './config/env.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { originCheckMiddleware } from './common/middleware/origin-check.middleware.js';
import { requestIdMiddleware } from './common/middleware/request-id.middleware.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const origins = parseOrigins(config.get<string>('CORS_ORIGINS') ?? '');

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(originCheckMiddleware(origins));

  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.enableShutdownHooks();

  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RestoDash POS API')
      .setDescription('API backend cho quán ăn — Phase 1')
      .setVersion('1.0')
      .addCookieAuth('restodash.sid')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }
}
