import { getAuctionById } from "../lib/getAuctionById";
import commonMiddleware from "../lib/commonMiddleware";

async function getAuction(event) {
  const { id } = event.pathParameters;

  const auction = await getAuctionById(id);

  return {
    statusCode: 200,
    body: JSON.stringify(auction),
  };
}

export const handler = commonMiddleware(getAuction);
