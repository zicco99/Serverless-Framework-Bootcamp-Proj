import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { PlayersModule } from './players/players.module';

@Module({
  imports: [AuctionsModule, PlayersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
