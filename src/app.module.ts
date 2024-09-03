import { Module } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { Context } from 'telegraf';
import { SessionSpace } from './users/models/user.model';
import { AuctionWizard } from './telegram/wizards/create-auction.wizard';

interface BotContext extends Context {
  session_space: SessionSpace;
}

@Module({
  imports: [
    AuctionsModule,
    TelegrafModule.forRoot({
      token: process.env.BOT_TELEGRAM_KEY || '',
      launchOptions: {
        webhook: {
          domain: process.env.GATEWAY_URL || '',
          path: '/dev/webhook',
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
          'poll_answer',
        ],
      },
    } as TelegrafModuleOptions),
  ],
  controllers: [],
  providers: [AppService, AuctionWizard],
})
export class AppModule {}

export { SessionSpace, BotContext };
