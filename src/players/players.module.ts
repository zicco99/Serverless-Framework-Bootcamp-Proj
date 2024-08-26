import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayersService } from './players.service';
import { SportmonksService } from 'src/services/sport-monk.service';
import { PlayersController } from './players.controller';

/*
Cross-Cutting Concerns: If you have services that are commonly used throughout the application, 
such as services like authentication, database connections, or HTTP clients, it makes sense to make the module global.
*/
@Global()
@Module({
  imports: [HttpModule],
  controllers: [PlayersController],
  providers: [PlayersService, SportmonksService],
  exports: [PlayersService],
})
export class PlayersModule {}

