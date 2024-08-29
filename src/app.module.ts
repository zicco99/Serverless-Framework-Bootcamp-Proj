import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';

const telegrafOptions: TelegrafModuleOptions = {
  token: process.env.BOT_TELEGRAM_KEY || "",
  launchOptions: {
    webhook: {
      domain: process.env.WEBHOOK_DOMAIN || "", 
      path: process.env.WEBHOOK_PATH || "/webhook", 
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
};

@Module({
  imports: [
    TelegrafModule.forRoot(telegrafOptions),
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
