import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { Telegraf } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';

let cachedServer: Server;

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

async function bootstrapServer(webhookCallbacBasekUrl: string): Promise<Server> {
  const expressApp = require('express')();

  const botToken = process.env.BOT_TELEGRAM_KEY; 
  if (!botToken) {
    throw new Error('BOT_TELEGRAM_KEY is not defined');
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });

  // Configuring a webhook middleware
  const bot = app.get(getBotToken());
  bot.telegram.botName
  app.use(bot.webhookCallback('/webhook'));

  const webhookInfo = await bot.telegram.getWebhookInfo();
  console.log('Webhook Info:', webhookInfo);

  if(webhookInfo.url !== webhookCallbacBasekUrl + '/webhook') {
    await bot.telegram.setWebhook(webhookCallbacBasekUrl + '/webhook'),{
      drop_pending_updates: true,  
      webhook_reply: true,         
      webhook_reply_timeout: 3000 
    };
  }

  await app.init();

  return serverless.createServer(expressApp);
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {

  //Set it using https://api.telegram.org/<TOKEN>/setWebhook?url=<YOUR-HOSTED-SERVER>/webhook
  if (!cachedServer) {
    const webhookCallbacBasekUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    cachedServer = await bootstrapServer(webhookCallbacBasekUrl);
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
