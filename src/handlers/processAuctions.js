import createError from "http-errors";
import { closeAuction } from "../lib/closeAuction";
import { getEndedAuctions } from "../lib/getEndedAuctions";

async function processAuctions() {
  try {
    const auctions = await getEndedAuctions();
    const closedAuctions = await Promise.all(auctions.map(closeAuction));

    return { closed: closedAuctions.length };
  } catch (error) {
    throw new createError.InternalServerError(error);
  }
}

export const handler = processAuctions;
