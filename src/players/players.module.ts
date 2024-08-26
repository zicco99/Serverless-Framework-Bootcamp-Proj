import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayersService } from './players.service';
import { SportmonksService } from 'src/services/sport-monk.service';
import { PlayersController } from './players.controller';

@Global()
@Module({
  imports: [HttpModule],
  controllers: [PlayersController],
  providers: [PlayersService, SportmonksService],
  exports: [PlayersService],
})
export class PlayersModule {}

