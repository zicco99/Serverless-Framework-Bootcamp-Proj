import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayersService } from './players.service';
import { SportmonksService } from 'src/services/sport-monk.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [PlayersService, SportmonksService],
  exports: [PlayersService],
})
export class PlayersModule {}

