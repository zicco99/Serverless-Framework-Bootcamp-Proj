import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { createServer, proxy } from '@codegenie/serverless-express';
import express, { Express } from 'express'; // Explicit import of Express

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let cachedServer: ReturnType<typeof createServer> | null = null;

/**
 * Creates and initializes the NestJS application with Express.
 */
async function createNestServer(): Promise<Express> {
  const expressApp = express(); // Create an Express application instance
  const nestApp = await NestFactory.create(AppModule, expressApp);
  await nestApp.init(); // Initialize the NestJS application
  return expressApp;
}

/**
 * Bootstraps the Express server and caches it for subsequent invocations.
 * @returns {Promise<ReturnType<typeof createServer>>}
 */
async function bootstrapServer(): Promise<ReturnType<typeof createServer>> {
  if (!cachedServer) {
    try {
      const expressApp = await createNestServer();
      cachedServer = createServer(expressApp); // Create the server using @codegenie/serverless-express
    } catch (error) {
      console.error('Error bootstrapping server:', error);
      throw error;
    }
  }
  return cachedServer;
}

/**
 * AWS Lambda handler function.
 * Handles incoming events and proxies them to the Express server.
 * @param event {APIGatewayProxyEvent}
 * @param context {Context}
 * @returns {Promise<any>}
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  return proxy(cachedServer, event, context);
};

/**
 * Global error handling for unhandled promises and exceptions.
 */
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (reason) => {
  console.error('Uncaught Exception:', reason);
});
