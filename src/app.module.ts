import { Module } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { InjectSessionSpaceMiddleware } from './telegram/middlewares/session-space.middleware';
import { AuctionWizard } from './auctions/wizards/create-auction.wizard';
import { RedisClusterService } from 'src/services/redis/redis-custer.service'; 
import { session } from 'telegraf';

@Module({
  imports: [
    AuctionsModule,
    TelegrafModule.forRootAsync({
      imports: [AuctionsModule],
      inject: [AuctionWizard, RedisClusterService],
      useFactory: (auctionWizard: AuctionWizard, redisService: RedisClusterService): TelegrafModuleOptions => {
        const sessionSpaceMiddleware = new InjectSessionSpaceMiddleware(auctionWizard, redisService).use;
        return {
          token: process.env.BOT_TELEGRAM_KEY || '',
          middlewares: [
            session(),
            sessionSpaceMiddleware,
          ],
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
        };
      },
    }),
  ],
  controllers: [],
  providers: [AppService, InjectSessionSpaceMiddleware],
})
export class AppModule {}
