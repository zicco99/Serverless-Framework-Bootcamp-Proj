import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { BloomFilterManagerService } from 'src/lib/bloom-filter.service';

@Module({
  controllers: [PlayersController],
  providers: [PlayersService, BloomFilterManagerService],
})
export class PlayersModule {}
