import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Auction } from './models/auction.model';
import { CreateAuctionDto } from './dtos/create-auction.dto';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  findAll() {
    return this.auctions.findAll();
  }

  @Post()
  createAuction(
    @Body() createAuctionDto: CreateAuctionDto
    ) : Auction {
    return this.auctions.createAuction(createAuctionDto);

  }
  
}