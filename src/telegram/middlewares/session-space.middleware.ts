import { Injectable, NestMiddleware } from '@nestjs/common';
import { AuctionWizard } from 'src/auctions/wizards/create-auction.wizard';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';
import { BotContext } from 'src/users/models/user.model';
import { getOrInitUserSessionSpace, Intent } from 'src/users/models/user.model';

const AUTH_LOCK_MAX_TTL = 500;
const MAX_SCENE_TTL = 3600 * 1000;

//---------------------
// InjectSessionSpaceMiddleware
// - basically checks if the user has a session_space ( on Redis ), o/w create a new one then
// if in the session_space the intent is not NONE, then load the scene
// - it also injects the session_space into the context
//---------------------

@Injectable()
export class InjectSessionSpaceMiddleware implements NestMiddleware {
  constructor(
    private readonly auctionWizard: AuctionWizard,
    private readonly redisService: RedisClusterService
  ) {}

  async use(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    const userId = ctx.from?.id;

    if (!userId) {
      await next();
      return;
    }

    await this.redisService.handleWithLock(userId, AUTH_LOCK_MAX_TTL, async () => {
      const { session_space } = await getOrInitUserSessionSpace(
        userId,
        ctx,
        this.auctionWizard.getSessionSpace.bind(this.auctionWizard),
        this.auctionWizard.initSessionSpace.bind(this.auctionWizard)
      );

      if (!session_space) {
        await ctx.reply("Unable to identify you. Please try again.", { parse_mode: 'MarkdownV2' });
        await next();
        return;
      }

      ctx.session_space = session_space;

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
      }
      await next();
    });
  }
}
