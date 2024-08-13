import { v4 as uuid } from 'uuid';
import AWS from 'aws-sdk';
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import httpEventNormalizer from '@middy/http-event-normalizer';
import createError from 'http-errors';

// Initialize DynamoDB DocumentClient
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function createAuction(event) {
  let title;

  try {
    const body = JSON.parse(event.body);
    title = body.title;

    if (!title) {
      throw new createError.BadRequest('Title is required');
    }

    const auction = {
      id: uuid(),
      title: title,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      Item: auction
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(auction),
    };

  } catch (error) {
    console.error('Error creating auction:', error);

    if (error instanceof createError.HttpError) {
      throw error;
    }
    throw new createError.InternalServerError('An unexpected error occurred');
  }
}

// Wrap the handler with Middy middleware
export const handler = middy(createAuction)
  .use(httpJsonBodyParser())
  .use(httpEventNormalizer())
  .use(httpErrorHandler());
