import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Auction } from './models/auction.model';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  findAll() {
    return this.auctions.findAll();
  }

  @Post()
  createAuction(
    @Body("title") title: string, 
    @Body("description") description: string, 
    @Body("startDate") startDate: Date, 
    @Body("endDate") endDate: Date
    ) : Auction {
    return this.auctions.createAuction(title, description, startDate, endDate);

  }
  
}