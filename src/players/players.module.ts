import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { SportmonksService } from 'src/services/sport-monk.service';
import { HttpService } from '@nestjs/axios';

@Module({
  imports: [HttpService],
  controllers: [PlayersController],
  providers: [
    PlayersService,
    SportmonksService
  ],
})
export class PlayersModule {}