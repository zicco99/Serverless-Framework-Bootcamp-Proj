import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [AuctionsModule, TeamsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
