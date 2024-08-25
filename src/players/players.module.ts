import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { SportmonksService } from 'src/services/sport-monk.service';
import { HttpService } from '@nestjs/axios';

@Module({
  controllers: [PlayersController],
  providers: [
    PlayersService,
    SportmonksService,
    HttpService
  ],
})
export class PlayersModule {}