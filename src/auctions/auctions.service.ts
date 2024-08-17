import { Injectable } from '@nestjs/common';
import { Auction,AuctionStatus } from 'src/auctions/models/auction.model';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuctionsService {
  private readonly auctions: Auction[] = [];

  findAll(): Auction[] {
    return this.auctions;
  }

  createAuction(name: string, description: string, startDate: Date, endDate: Date): Auction {
    const new_auction : Auction = {
      id: uuid(),
      name,
      description,
      status: AuctionStatus.OPEN,
      startDate,
      endDate,
      createdDate: new Date(),
      updatedDate: new Date()
    }

    this.auctions.push(new_auction);

    return new_auction;
  }
}