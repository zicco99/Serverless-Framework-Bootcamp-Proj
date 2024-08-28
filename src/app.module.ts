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
    TelegrafModule.forRoot({
      token: process.env.BOT_TELEGRAM_KEY || '',
      launchOptions: {
        webhook: {
          domain: process.env.WEBHOOK_URL || '',
          path: '/webhook',
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
