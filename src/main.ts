import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express'; // Ensure correct import for express
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { Telegraf } from 'telegraf'; // Import Telegraf directly
import { ValidationPipe } from '@nestjs/common';

let cachedServer: Server;

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

async function bootstrapServer(webhookCallbacBasekUrl: string): Promise<Server> {
  const expressApp = require('express')();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });
  
  const botToken = process.env.BOT_TELEGRAM_KEY; 
  if (!botToken) {
    throw new Error('BOT_TELEGRAM_KEY is not defined');
  }

  const bot = new Telegraf(botToken);

  bot.telegram.setWebhook(webhookCallbacBasekUrl + '/webhook');
  expressApp.use(bot.webhookCallback('/webhook'));

  await app.init();

  return serverless.createServer(expressApp);
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  if (!cachedServer) {
    const webhookCallbacBasekUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    cachedServer = await bootstrapServer(webhookCallbacBasekUrl);
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
