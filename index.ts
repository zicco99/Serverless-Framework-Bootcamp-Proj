import { NestFactory } from '@nestjs/core';
import { AppModule } from './serverless-backend/src/app.module';
import { Callback, Context, Handler } from 'aws-lambda';
import { configure } from '@codegenie/serverless-express';

let server: Handler;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();

  const expressHandler = app.getHttpAdapter().getInstance();

  return configure({ app: expressHandler });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  server = server ?? (await bootstrap());
  return server(event, context, callback);
}