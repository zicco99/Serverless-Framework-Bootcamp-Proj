import { Injectable } from '@nestjs/common';

@Injectable()
export class AuctionsService {
  private readonly auctions: string[] = [];

  findAll(): string[] {
    return this.auctions;
  }
}