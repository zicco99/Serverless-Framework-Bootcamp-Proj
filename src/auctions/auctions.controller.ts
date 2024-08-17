import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dtos/create-auction.dto';
import { DeleteAuctionDto } from './dtos/delete-auction.dto';
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

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAuctionDto: Partial<UpdateAuctionDto>,
  ): Promise<Auction> {
    return this.auctionsService.updateAuction(id, updateAuctionDto);
  }

  @Delete()
  async delete(@Body() deleteAuctionDto: DeleteAuctionDto): Promise<Auction> {
    return this.auctionsService.deleteAuction(deleteAuctionDto);
  }
}
