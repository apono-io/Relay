import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { AppModule } from './app.module';
import { assertProductionConfigSafe } from './core/auth/production-config.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  assertProductionConfigSafe(app.get(ConfigService));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Relay backend failed to start:', error);
  process.exit(1);
});
