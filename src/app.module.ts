import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';

@Module({
  imports: [AuctionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
