import { Global, Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionWizard } from './wizards/create-auction.wizard';

@Global()
@Module({
  providers: [AuctionsService, AuctionWizard],
  exports: [AuctionsService, AuctionWizard],
})
export class AuctionsModule {}

