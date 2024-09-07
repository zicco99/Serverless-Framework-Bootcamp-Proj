import { Module, Injectable } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { Context, Scenes, session } from 'telegraf';
import { getOrInitUserSessionSpace, SessionSpace } from './users/models/user.model';
import { AuctionWizard } from './telegram/wizards/create-auction.wizard';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';

/**
 * A type that extends the default Context with SessionSpace,
 * which is used to store user session data.
 */
export interface BotContext extends Context, Scenes.WizardContext {
  /**
   * The session space property is used to store user session data.
   */
  session_space: SessionSpace;
}

@Injectable()
export class BotSessionMiddleware {
  constructor(private readonly auctionWizard: AuctionWizard, private readonly redisService: RedisClusterService) {}

  async use(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    if (ctx.from?.id) {
      const { session_space } = await getOrInitUserSessionSpace(
        ctx.from.id,
        ctx,
        this.auctionWizard.getSessionSpace.bind(this.auctionWizard),
        this.auctionWizard.initSessionSpace.bind(this.auctionWizard)
      );

      if(!session_space){
        ctx.reply("Unable to identify you. Please try again.", { parse_mode: 'MarkdownV2' });
        return;
      }
        
      ctx.session_space = session_space;
    }
    return next();
  }
}

@Module({
  imports: [
    AuctionsModule,
    TelegrafModule.forRootAsync({
      imports: [AuctionsModule, RedisClusterService],
      inject: [AuctionWizard, RedisClusterService],
      useFactory: (auctionWizard: AuctionWizard, redisService: RedisClusterService): TelegrafModuleOptions => ({
        token: process.env.BOT_TELEGRAM_KEY || '',
        middlewares: [
          session(),
          new BotSessionMiddleware(auctionWizard, redisService).use,
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
  providers: [AppService, RedisClusterService, AuctionWizard],
})
export class AppModule {}
