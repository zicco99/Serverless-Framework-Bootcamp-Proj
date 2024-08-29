import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { Telegraf } from 'telegraf';

let cachedServer: Server;
let webhookSet = false;

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

async function bootstrapServer(webhookCallbackBaseUrl: string): Promise<Server> {
  console.log("Webhook Callback Base URL:", webhookCallbackBaseUrl);

  const expressApp = require('express')();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });

  const bot = app.get(Telegraf);
  if (!bot) {
    throw new Error('Telegraf instance is not available');
  }

  // Middleware for webhook
  app.use(bot.webhookCallback('/webhook'));

  if (!webhookSet) {
    const desiredWebhookUrl = `${webhookCallbackBaseUrl}/webhook`;

    try {
      // Check current webhook info
      const webhookInfo = await bot.telegram.getWebhookInfo();
      console.log("Current Webhook Info:", webhookInfo);

      // Only set the webhook if it's not already set correctly
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
        webhookSet = true;  // Mark that the webhook has been set
      } else {
        console.log('Webhook is already set correctly.');
        webhookSet = true;  // Mark that the webhook has been checked and is correct
      }
    } catch (error) {
      console.error('Error setting or fetching webhook info:', error);
    }
  }

  await app.init();
  return serverless.createServer(expressApp);
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  if (!cachedServer) {
    const webhookCallbackBaseUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    cachedServer = await bootstrapServer(webhookCallbackBaseUrl);
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
