import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import createError from "http-errors";
import validator from "@middy/validator";
import cors from "@middy/http-cors";
import { uploadPictureToS3 } from "../lib/uploadPictureToS3";
import { getAuctionById } from "../lib/getAuctionById";
import { setAuctionPicturUrl } from "../lib/setAuctionPictureUrl";
import schema from "../lib/schemas/auctionPictureSchema";

async function uploadAuctionPicture(event) {
  console.log(`uploading picture to ${process.env.AUCTIONS_BUCKET_NAME}`);

  const { id } = event.pathParameters;
  const auction = await getAuctionById(id);

  const { email } = event.requestContext.authorizer;

  if (auction.seller !== email) {
    throw new createError.Forbidden("You are not the seller of this auction");
  }

  const base64image = event.body.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64image, "base64");

  let updatedAuction;

  try {
    const pictureUrl = await uploadPictureToS3(`${auction.id}.jpg`, buffer);
    updatedAuction = await setAuctionPicturUrl(id, pictureUrl);
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

export const handler = middy(uploadAuctionPicture)
  .use(cors())
  .use(httpErrorHandler())
  .use(validator({ inputSchema: schema }));
