import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayersService } from './players.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}

