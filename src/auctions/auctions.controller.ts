import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Auction } from './models/auction.model';
import { CreateAuctionDto } from './dtos/create-auction.dto';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  findAll() : Auction[]{
    return this.auctions.findAll();
  }

  @Get('/:id')
  getTaskbyId(@Param('id') id: string): Auction{
    const auction : Auction | undefined = this.auctions.findOne(id);
    if (!auction) {
      throw new Error('Auction not found');
    }
    return auction;
  }

  @Post()
  createAuction(
    @Body() createAuctionDto: CreateAuctionDto
    ) : Auction {
    return this.auctions.createAuction(createAuctionDto);
  }
  
}