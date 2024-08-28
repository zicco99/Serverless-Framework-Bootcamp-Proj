import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';

let cachedServer: Server;

process.on('unhandledRejection', (reason: any) => {
  console.error(reason);
});

process.on('uncaughtException', (reason) => {
  console.error(reason);
});

async function bootstrapServer(): Promise<Server> {
  const expressApp = require('express')();
  const adapter = new ExpressAdapter(expressApp);

  return NestFactory.create(AppModule, adapter, { logger: ['debug', 'log', 'error', 'warn'] })
    .then((app) => app.init())
    .then(() => serverless.createServer(expressApp));
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {

  //Set it using https://api.telegram.org/<TOKEN>/setWebhook?url=
  process.env.WEBHOOK_URL = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;

  if (!cachedServer)
  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
