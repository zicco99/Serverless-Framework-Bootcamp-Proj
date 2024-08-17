import { Controller, Get } from '@nestjs/common';
import { AuctionsService } from './auctions.service';

@Controller('users')
export class AuctionsController {
  constructor(private readonly userService: AuctionsService) {}

  @Get()
  findAll() {
    // Handle GET requests and use UserService to fetch data
  }
}