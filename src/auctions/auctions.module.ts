import { Global, Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';

@Global()
@Module({
  providers: [AuctionsService],
  exports: [AuctionsService],
})
export class AuctionsModule {}