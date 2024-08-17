import { v4 as uuid } from 'uuid';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Auction,AuctionStatus } from 'src/auctions/models/auction.model';

import { CreateAuctionDto } from './dtos/create-auction.dto';
import { DeleteAuctionDto } from './dtos/delete-auction.dto';
import { UpdateAuctionDto } from './dtos/update-auction.dto';

@Injectable()
export class AuctionsService {
  private readonly auctions: Auction[] = [];

  findAll(): Auction[] {
    return this.auctions;
  }

  findOne(id: string): Auction {
    const auction = this.auctions.find(auction => auction.id === id);
    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }
    return auction;
  }

  createAuction(createAuctionDto: CreateAuctionDto): Auction {
    const { name, description, startDate, endDate } = createAuctionDto;

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const new_auction: Auction = {
      id: uuid(),
      name,
      description,
      status: AuctionStatus.OPEN,
      startDate,
      endDate,
      createdDate: new Date(),
      updatedDate: new Date(),
    };

    this.auctions.push(new_auction);
    return new_auction;
  }

  deleteAuction(deleteAuctionDto: DeleteAuctionDto): Auction {
    const { id } = deleteAuctionDto;
    const index = this.auctions.findIndex(auction => auction.id === id);
    if (index === -1) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    const [auction] = this.auctions.splice(index, 1);
    return auction;
  }

  updateAuction(id: string, updateAuctionDto: Partial<UpdateAuctionDto>): Auction {
    const index = this.auctions.findIndex(auction => auction.id === id);

    if (index === -1) {
        throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    const updatedAuction: Auction = {
      ...this.auctions[index],
      ...updateAuctionDto,
      updatedDate: new Date(),
    };

    this.auctions[this.auctions.findIndex(auc => auc.id === id)] = updatedAuction;
    return updatedAuction;
  }
}