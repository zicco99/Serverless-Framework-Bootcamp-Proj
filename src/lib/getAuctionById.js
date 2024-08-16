import AWS from "aws-sdk";
import createError from "http-errors";

const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function getAuctionById(id) {
  let auction;

  try {
    const result = await dynamoDB
      .get({ Key: { id }, TableName: process.env.AUCTIONS_TABLE_NAME })
      .promise();

    auction = result.Item;
  } catch (error) {
    throw new createError.InternalServerError(error);
  }

  if (!auction) {
    throw new createError.NotFound(`Auction with id not found (${id})`);
  }

  return auction;
}
