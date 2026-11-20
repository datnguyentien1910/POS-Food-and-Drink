import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';
import { PASSWORD_SESSION_MS, SESSION_COOKIE } from './auth/auth.constants.js';
import { PgSessionStore, SESSION_STORE } from './auth/session.store.js';
import { parseOrigins } from './config/env.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { originCheckMiddleware } from './common/middleware/origin-check.middleware.js';
import { requestIdMiddleware } from './common/middleware/request-id.middleware.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const origins = parseOrigins(config.get<string>('CORS_ORIGINS') ?? '');
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const sessionStore = app.get<PgSessionStore>(SESSION_STORE, { strict: false });

  // CSP is disabled only so the local Swagger UI renders; the other helmet
  // headers stay on and production must revisit this.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use(
    session({
      store: sessionStore.store,
      name: SESSION_COOKIE,
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: PASSWORD_SESSION_MS,
      },
    }),
  );
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
      .addCookieAuth(SESSION_COOKIE)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }
}
