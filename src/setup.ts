import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { HttpExceptionFilter } from './common/http-exception.filter';
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim()),
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('TaskFlow API')
      .setDescription(
        'Workspace-scoped project management. Obtain a JWT via /auth/login, then use Authorize. Access: 15 minutes; refresh: 7 days.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: false },
  });
  return document;
}
