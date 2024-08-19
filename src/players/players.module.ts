import { Module } from '@nestjs/common';
import { S3HashRingController  } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  controllers: [S3HashRingController],
  providers: [PlayersModule],
})
export class PlayersModule {}