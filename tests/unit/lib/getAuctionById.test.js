import { InternalServerError, NotFound } from "http-errors";
import { getAuctionById } from "../../../src/lib/getAuctionById";

jest.mock("aws-sdk", () => {
  return {
    DynamoDB: {
      DocumentClient: class {
        constructor() {
          this.get = ({ Key: { id } }) => {
            if (!id) throw new Error();
            const returnValue = id === "123" ? { id: "123" } : undefined;
            return { promise: () => Promise.resolve({ Item: returnValue }) };
          };
        }
      },
    },
  };
});

describe("getAuctionById", () => {
  it("returns the auction with the given id", async () => {
    const { id } = await getAuctionById("123");
    expect(id).toBe("123");
  });

  it("throws an internal server error when dynamo fails", async () => {
    await expect(getAuctionById()).rejects.toThrow(InternalServerError);
  });

  it("throws a not found error if item with given id does not exist", async () => {
    await expect(getAuctionById("234")).rejects.toThrow(NotFound);
  });
});
