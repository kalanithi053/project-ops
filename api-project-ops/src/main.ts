import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/httpExceptionFilter';
import { ResponseInterceptor } from './common/interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'ProjectOps',
    }),
  });
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT') ?? 3000;
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'DEV';
  app.setGlobalPrefix('api/v1');
  const cors = config.getOrThrow<string>('CORS').split(';');
  app.enableCors({
    origin: cors,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-slug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`ProjectOps - (${nodeEnv})`)
    .setDescription('ProjectOps API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: 'x-workspace-slug',
      in: 'header',
      required: false,
      description: 'Active workspace slug (required on workspace-scoped routes)',
      schema: { type: 'string' },
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/api/doc', app, document);

  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(port);
}
bootstrap();
