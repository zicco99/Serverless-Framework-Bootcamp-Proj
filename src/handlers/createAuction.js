import AWS from 'aws-sdk';
import commonMiddleware from '../lib/commonMiddleware';
import validator from '@middy/validator';
import createError from 'http-errors';
import { v4 as uuid } from 'uuid';
import createAuctionSchema from '../lib/schemas/createAuctionSchema';


const dynamodb = new AWS.DynamoDB.DocumentClient();

async function createAuction(event) {
  const { title } = event.body;
  const now = new Date();
  const endDate = new Date();

  endDate.setHours(now.getHours() + 1);

  const auction = {
    id: uuid(),
    title,
    status: 'OPEN',
    createdAt: now.toISOString(),
    endingAt: endDate.toISOString(),
    highestBid: {
      amount: 0,
    },
  };

  try {
    await dynamodb.put({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      Item: auction,
    }).promise();
  } catch (error) {
    console.error('Error creating auction:', error);
    throw new createError.InternalServerError('Failed to create auction');
  }

  return {
    statusCode: 201,
    body: JSON.stringify(auction),
  };
}

// Apply common middleware and validator middleware
export const handler = commonMiddleware(createAuction).use(
  validator({ eventSchema: createAuctionSchema })
);
