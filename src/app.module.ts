import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';

@Module({
  imports: [
    TelegrafModule.forRoot({
      token: process.env.BOT_TELEGRAM_KEY || "",
      launchOptions: {
        webhook: {
          domain: process.env.GATEWAY_URL || "", 
          path: "/webhook", 
          maxConnections: 40,
        },
        dropPendingUpdates: true,
        allowedUpdates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'callback_query',
          'inline_query',
          'chosen_inline_result',
          'shipping_query',
          'pre_checkout_query',
          'poll',
          'poll_answer'
        ],
      },
    } as TelegrafModuleOptions,
  )],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
