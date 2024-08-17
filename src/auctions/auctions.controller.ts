import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { AuctionsService } from './auctions.service';
import { Auction } from './models/auction.model';

import { CreateAuctionDto } from './dtos/create-auction.dto';
import { DeleteAuctionDto } from './dtos/delete-auction.dto';
import { UpdateAuctionDto } from './dtos/update-auction.dto';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  findAll() : Auction[]{
    return this.auctions.findAll();
  }

  @Get('/:id')
  getTaskbyId(@Param('id') id: string): Auction{
    const auction : Auction = this.auctions.findOne(id);

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

  @Delete('/:id')
  deleteAuction(@Body() deleteAuctionDto: DeleteAuctionDto): void {
    this.auctions.deleteAuction(deleteAuctionDto);
  }

  @Patch('/:id')
  updateAuction(
    @Param('id') id: string,
    @Body() updateAuctionDto: UpdateAuctionDto
  ): Auction {
    return this.auctions.updateAuction(id, updateAuctionDto);
  }
}