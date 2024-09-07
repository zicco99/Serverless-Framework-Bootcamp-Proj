import { Module } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { InjectSessionSpaceMiddleware } from './telegram/middlewares/session-space.middleware';
import { AuctionWizard } from './auctions/wizards/create-auction.wizard'; 
import { RedisClusterService } from 'src/services/redis/redis-custer.service'; 
import { session } from 'telegraf';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      inject: [AuctionWizard, RedisClusterService],
      useFactory: (auctionWizard: AuctionWizard, redisService: RedisClusterService): TelegrafModuleOptions => ({
        token: process.env.BOT_TELEGRAM_KEY || '',
        middlewares: [
          session(),
          (ctx, next) => new InjectSessionSpaceMiddleware(auctionWizard, redisService).use(ctx, next),
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
      }),
    }),
  ],
  controllers: [],
  providers: [AppService, AuctionWizard, RedisClusterService],
})
export class AppModule {}
