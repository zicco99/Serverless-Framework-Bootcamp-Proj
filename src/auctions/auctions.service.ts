import { Injectable } from '@nestjs/common';
import { Auction,AuctionStatus } from 'src/auctions/models/auction.model';
import { v4 as uuid } from 'uuid';
import { CreateAuctionDto } from './dtos/create-auction.dto';

@Injectable()
export class AuctionsService {
  private readonly auctions: Auction[] = [];

  findAll(): Auction[] {
    return this.auctions;
  }

  createAuction(createAuctionDto: CreateAuctionDto): Auction {
    const { name, description, startDate, endDate } = createAuctionDto;

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