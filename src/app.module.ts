import { Module, Injectable } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { Context, Scenes, session } from 'telegraf';
import { getOrInitUserSessionSpace, Intent, SessionSpace } from './users/models/user.model';
import { AuctionWizard } from './telegram/wizards/create-auction.wizard';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';

/**
 * A type that extends the default Context with SessionSpace,
 * which is used to store user session data.
 * It extends the default Context and Scene Context.
 */
export interface BotContext extends Context, Scenes.WizardContext {
  session_space: SessionSpace;
}

const AUTH_LOCK_MAX_TTL = 500;
const MAX_SCENE_TTL = 3600 * 1000;

@Injectable()
export class InjectSessionSpaceMiddleware {
  constructor(private readonly auctionWizard: AuctionWizard, private readonly redisService: RedisClusterService) {}

  async use(ctx: BotContext, next: () => Promise<void>): Promise<void> {

    const userId = ctx.from?.id!;

    this.redisService.handleWithLock(userId, AUTH_LOCK_MAX_TTL, async () => {
      if (!ctx)
        return next();

      if (ctx.from?.id) {
        const { session_space } = await getOrInitUserSessionSpace(
          ctx.from.id,
          ctx,
          this.auctionWizard.getSessionSpace.bind(this.auctionWizard),
          this.auctionWizard.initSessionSpace.bind(this.auctionWizard)
        );
  
        if(!session_space){
          ctx.reply("Unable to identify you. Please try again.", { parse_mode: 'MarkdownV2' });
          return next();
        }
          
        ctx.session_space = session_space;

        //Check if intentTTL has expired o/w load scene
        if (session_space.last_intent !== Intent.NONE) {
          const isExpired = (Date.now() - new Date(session_space.last_intent_timestamp).getTime()) > MAX_SCENE_TTL;
          if (!isExpired) {
            switch (session_space.last_intent) {
              case Intent.CREATE_AUCTION:
                console.log("Found intent: CREATE_AUCTION, entering the scene!");
                await ctx.scene.enter('auction-wizard');
                return;
            }
          }
          return next();
        }
      }
    });    
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
          new InjectSessionSpaceMiddleware(auctionWizard, redisService).use,
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
