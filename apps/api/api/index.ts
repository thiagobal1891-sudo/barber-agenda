import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

import express from 'express';
import serverlessExpress from '@vendia/serverless-express';

const expressApp = express();

let server: any;

async function bootstrap() {
  console.log('[Bootstrap] Starting...');
  
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  const configService = app.get(ConfigService);

  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:3000',
  );

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      const configService = app.get(ConfigService);
      const frontendUrl = configService.get<string>('FRONTEND_URL');
      const allowedOrigins = [
        frontendUrl,
        'https://TU-FRONTEND.vercel.app',
      ];
      if (!origin || allowedOrigins.includes(origin) || /\.barberos\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Prefix
  app.setGlobalPrefix('api/v1');

  // Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  
  console.log('[Bootstrap] NestJS initialized');

  return serverlessExpress({
    app: expressApp,
  });
}

export default async function handler(req: any, res: any) {
  try {
    console.log(`[Handler] ${req.method} ${req.url}`);
    
    if (!server) {
      console.log('[Handler] Bootstrapping NestJS...');
      server = await bootstrap();
      console.log('[Handler] Bootstrap complete, handling request');
    }

    return await server(req, res);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('[Handler ERROR]', errorMessage);
    console.error('[Handler STACK]', errorStack);

    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }
}