import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { getBotToken } from 'nestjs-telegraf';

let cachedServer: Server;

process.on('unhandledRejection', (reason: any) => {
  console.error(reason);
});

process.on('uncaughtException', (reason) => {
  console.error(reason);
});

async function bootstrapServer(): Promise<Server> {
  const expressApp = require('express')();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });

  const bot = app.get(getBotToken());
  app.use(bot.webhookCallback('/webhook')); 

  await app.init();

  return serverless.createServer(expressApp);
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {

  //Set it using https://api.telegram.org/<TOKEN>/setWebhook?url=
  process.env.WEBHOOK_URL = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;

  if (!cachedServer)
  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
