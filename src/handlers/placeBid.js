import createError from "http-errors";
import AWS from "aws-sdk";
import validator from "@middy/validator";
import commonMiddleware from "../lib/commonMiddleware";
import { getAuctionById } from "../lib/getAuctionById";
import placeBidSchema from "../lib/schemas/placeBidSchema";

const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function placeBid(event) {
  const { id } = event.pathParameters;
  const { email } = event.requestContext.authorizer;

  const { amount } = event.body;

  const auction = await getAuctionById(id);

  // Extra validation turned off for easier developement for now

  // if (email === auction.seller) {
  //   throw new createError.Forbidden(`Your can't bid on your own auction`);
  // }

  // if (email === auction.highestBid.bidder) {
  //   throw new createError.Forbidden(`You are already the highest bidder`);
  // }

  if (auction.status === "CLOSED") {
    throw new createError.Forbidden(`Your can't bid on closed auctions`);
  }

  if (amount <= auction.highestBid.amount) {
    throw new createError.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}`);
  }

  const params = {
    Key: { id },
    TableName: process.env.AUCTIONS_TABLE_NAME,
    UpdateExpression: "set highestBid.amount = :amount, highestBid.bidder = :bidder",
    ExpressionAttributeValues: {
      ":amount": amount,
      ":bidder": email,
    },
    ReturnValues: "ALL_NEW",
  };

  let updatedAuction;

  try {
    const result = await dynamoDB.update(params).promise();
    updatedAuction = result.Attributes;
  } catch (error) {
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

export const handler = commonMiddleware(placeBid).use(validator({ inputSchema: placeBidSchema }));
