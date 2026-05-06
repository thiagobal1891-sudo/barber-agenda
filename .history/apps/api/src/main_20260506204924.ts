import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
 
  // ── Root Redirect & API Handler ─────────────────────────────────────────────
  app.getHttpAdapter().get('/', (req: any, res: any) => {
    res.redirect(frontendUrl);
  });

  app.use('/api/v1', (req: any, res: any, next: any) => {
    if (req.url === '/' || req.url === '') {
      return res.status(200).json({
        success: true,
        message: 'Vaon API is running!',
        portal: `Visit the Landing Page at ${frontendUrl}`,
        timestamp: new Date().toISOString(),
      });
    }
    next();
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      frontendUrl, 
      /\.barberos\.app$/,
      'https://TU-FRONTEND.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Global prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Global pipes ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,        // auto-transform types (string → number, etc.)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global filters ──────────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Global interceptors ─────────────────────────────────────────────────────
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`🚀 BarberOS API running on http://localhost:${port}/api/v1`);
}

bootstrap();
