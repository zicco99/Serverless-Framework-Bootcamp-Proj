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
let webhookSet = false;

process.on('uncaughtException', function (error) {
	console.log("\x1b[31m", "Exception: ", error, "\x1b[0m");
});

process.on('unhandledRejection', function (error, p) {
	console.log("\x1b[31m","Error: ", error, "\x1b[0m");
});

async function bootstrapServer(webhookCallbackBaseUrl: string): Promise<Server> {
  
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

    webhookSet = true;
  } catch (error) {
    console.error('Error setting or fetching webhook info:', error);
  }

  return serverless.createServer(expressApp);
}


export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  console.log("-- Event:", event);
  if (!cachedServer) {
    const webhookCallbackBaseUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    cachedServer = await bootstrapServer(webhookCallbackBaseUrl);
  }
  console.log("-- Cached Server:", cachedServer);
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
