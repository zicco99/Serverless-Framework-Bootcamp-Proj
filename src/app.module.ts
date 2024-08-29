// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({
  imports: [
    TelegrafModule.forRoot(
      {
        token: process.env.BOT_TELEGRAM_KEY || "",
      }
    ),
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
