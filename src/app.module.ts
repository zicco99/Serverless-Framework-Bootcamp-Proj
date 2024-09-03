import { Module } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { Context } from 'telegraf';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SessionSpace } from './users/models/user.model';


interface BotContext extends Context {
  session_space: SessionSpace;
}

// UserID -> SessionSpace
let sessions = new Map<number, SessionSpace>();

@Module({
  imports: [
    AuctionsModule,
    ClientsModule.register([
      {
        name: 'BOT_CACHE_CLIENT_REDIS',
        transport: Transport.REDIS,
        options: {
          host: process.env.BOT_STATE_ADDRESS,
          port: 6379,
        },
      },
    ]),
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
  providers: [AppService,],
})
export class AppModule {}

export { SessionSpace, BotContext };
