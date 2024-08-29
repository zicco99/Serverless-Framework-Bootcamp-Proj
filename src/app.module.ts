// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { TeamsModule } from './teams/teams.module';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({
  imports: [
    AuctionsModule,
    TeamsModule,
    TelegrafModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
