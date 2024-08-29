import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { getBotToken } from 'nestjs-telegraf';
import * as express from 'express';

let cachedServer: Server;

process.on('uncaughtException', function (error) {
  console.error("Uncaught Exception:", error);
});

process.on('unhandledRejection', function (reason, promise) {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

async function bootstrapServer(webhookCallbackBaseUrl: string): Promise<Server> {
  if (cachedServer) return cachedServer;

  const expressApp = require('express')();
  
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });
  await app.init();

  const bot = app.get(getBotToken());
  if (!bot) {
    throw new Error('Bot instance is not available');
  }

  const desiredWebhookUrl = `${webhookCallbackBaseUrl}/webhook`;

  try {
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log("Current Webhook Info:", webhookInfo);

    if (webhookInfo.url !== desiredWebhookUrl) {
      console.log('Setting new webhook to:', desiredWebhookUrl);
      await bot.telegram.setWebhook(desiredWebhookUrl, {
        drop_pending_updates: true,
        allowed_updates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'callback_query',
          'inline_query',
          'chosen_inline_result',
          'shipping_query',
          'pre_checkout_query',
          'poll',
          'poll_answer'
        ],
      });
      console.log('Webhook set successfully');
    } else {
      console.log('Webhook is already set correctly.');
    }
  } catch (error) {
    console.error('Error setting or fetching webhook info:', error);
  }

  cachedServer = serverless.createServer(expressApp);
  return cachedServer;
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  console.log("-- Event:", event);

  if (!cachedServer) {
    try {
      const webhookCallbackBaseUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
      cachedServer = await bootstrapServer(webhookCallbackBaseUrl);
    } catch (error) {
      console.error('Error bootstrapping server:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      };
    }
  }

  try {
    return await proxy(cachedServer, event, context, 'PROMISE').promise;
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
