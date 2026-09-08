import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:8082',
    'http://127.0.0.1:8082',
    'https://jobradarapp.com',
    'https://www.jobradarapp.com',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
