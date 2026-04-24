import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:4321'];
  app.enableCors({ origin: allowedOrigins });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Appointment System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
    console.log(`Swagger docs at http://localhost:${process.env.PORT ?? 3000}/docs`);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
