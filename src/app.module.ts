// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { TeamsModule } from './teams/teams.module';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({
  imports: [
    AuctionsModule,
    TeamsModule,
    TelegrafModule.forRoot(
      {
        botName: process.env.DEFAULT_BOT_NAME || "",
        token: process.env.BOT_TELEGRAM_KEY || "",
      }
    ),
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
