import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TeamsService } from './teams.service';
import { FootballApiService } from 'src/services/football-api/football-api.service';
import { TeamsController } from './teams.controller';

/*
Cross-Cutting Concerns: If you have services that are commonly used throughout the application, 
such as services like authentication, database connections, or HTTP clients, it makes sense to make the module global.
*/
@Global()
@Module({
  imports: [HttpModule],
  controllers: [TeamsController],
  providers: [TeamsService, FootballApiService],
  exports: [TeamsService],
})
export class TeamsModule {}

