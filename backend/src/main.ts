import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de un reverse proxy, habilita TRUST_PROXY=true para que el rate
  // limiting y los logs usen la IP real del cliente (X-Forwarded-For).
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
  ];
  const configuredOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
  const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins])];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (como apps móviles, Postman o curl)
      if (!origin) return callback(null, true);
      // Permitir localhost o cualquier IP de red local (192.168.x.x, 10.x.x.x) o configurados
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true); // En desarrollo permitir orígenes para evitar bloqueos de red
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('API Plataforma de Evaluaciones UUB')
    .setDescription('API REST para evaluaciones académicas, sesiones y calificación con IA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend corriendo en: http://0.0.0.0:${port}`);
  console.log(`📖 Documentación Swagger: http://localhost:${port}/api/docs`);
}
bootstrap();
