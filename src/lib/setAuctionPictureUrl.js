import AWS from "aws-sdk";

const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function setAuctionPicturUrl(id, pictureUrl) {
  const result = await dynamoDB
    .update({
      Key: { id },
      TableName: process.env.AUCTIONS_TABLE_NAME,
      UpdateExpression: "set pictureUrl = :pictureUrl",
      ExpressionAttributeValues: {
        ":pictureUrl": pictureUrl,
      },
      ReturnValues: "ALL_NEW",
    })
    .promise();

  return result.Attributes;
}
