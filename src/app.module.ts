import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AuctionsModule } from './auctions/auctions.module';
import { AuctionsService } from './auctions/auctions.service';

@Module({
  imports: [
    AuctionsModule,
    TelegrafModule.forRoot({
      token: process.env.BOT_TELEGRAM_KEY || "",
      middlewares: [
        // Add session middleware ( enriches the context with a session space )
        (ctx, next) => {
          ctx.session = ctx.session || {};
          return next();
        },
      ],
      launchOptions: {
        webhook: {
          domain: process.env.GATEWAY_URL || "", 
          path: "/dev/webhook", 
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
  providers: [AppService, AuctionsService],
})
export class AppModule {}
