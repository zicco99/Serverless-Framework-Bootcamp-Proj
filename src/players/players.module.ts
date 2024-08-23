import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  controllers: [PlayersController],
  providers: [
    PlayersService
  ],
})
export class PlayersModule {}