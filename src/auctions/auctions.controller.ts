import { Controller, Get, Post, Body, Param, Delete, Put, Query, Patch } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dtos/create-auction.dto';
import { UpdateAuctionDto } from './dtos/update-auction.dto';
import { Auction } from 'src/auctions/models/auction.model';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get()
  async findAll(): Promise<Auction[]> {
    return this.auctionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Auction> {
    return this.auctionsService.findOne(id);
  }

  @Post()
  async create(@Body() createAuctionDto: CreateAuctionDto): Promise<Auction> {
    return this.auctionsService.createAuction(createAuctionDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAuctionDto: Partial<UpdateAuctionDto>,
  ): Promise<Auction> {
    return this.auctionsService.updateAuction(id, updateAuctionDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<Auction> {
    return this.auctionsService.deleteAuction(id);
  }
}
