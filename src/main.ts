import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

/**
 * Orígenes que pueden llamar a la API desde el navegador.
 *
 * Se configuran con CORS_ORIGINS (separados por coma) para que agregar un
 * dominio nuevo no requiera tocar código ni rebuildar la imagen. Los de
 * desarrollo quedan siempre habilitados: son locales, no agregan superficie.
 */
const DEV_ORIGINS = ['http://localhost:4200', 'http://127.0.0.1:4200'];

function corsOrigins(): string[] {
  const extra = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...new Set([...DEV_ORIGINS, ...extra])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const origins = corsOrigins();
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
