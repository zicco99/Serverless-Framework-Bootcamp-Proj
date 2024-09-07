import { Global, Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionWizard } from './wizards/create-auction.wizard';

import { RedisClusterService } from 'src/services/redis/redis-custer.service';

@Global()
@Module({
  providers: [AuctionsService, AuctionWizard, RedisClusterService],
  exports: [AuctionsService, AuctionWizard, RedisClusterService],
})
export class AuctionsModule {}

