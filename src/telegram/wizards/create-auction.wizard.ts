import { Scene, SceneEnter, On, Ctx, Message } from 'nestjs-telegraf';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';
import { escapeMarkdown } from '../messages/.utils';
import { parseISO, isValid } from 'date-fns';
import { IntentExtra, SessionSpace } from 'src/users/models/user.model';
import { v4 as uuid } from 'uuid';

export interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

const sceneOption = { 
  ttl: 300,
  handlers: [],
  enterHandlers: [],
  leaveHandlers: [],
};

@Scene('auction-wizard', sceneOption)
export class AuctionWizard {
  private stepHandlers: { [key: number]: (ctx: BotContext, message: string) => Promise<void> } = {};

  constructor(
    private readonly auctions: AuctionsService,
    private readonly redisService: RedisClusterService,
  ) {
    this.stepHandlers = {
      1: this.handleStep1.bind(this),
      2: this.handleStep2.bind(this),
      3: this.handleStep3.bind(this),
      4: this.handleStep4.bind(this)
    };
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: BotContext) {

    await this.updateSessionSpace(ctx.from?.id!, { stepIndex: 1, data: {} });
    await ctx.reply(escapeMarkdown('🧙‍♂️ Welcome! Let’s create your auction. What’s the auction name?'));
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const userId = ctx.from?.id;

    if (!userId) {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid user ID.');
      return;
    }

    //Use redis to retrieve current step
    const stepIndex = await this.getCurrentStepIndex(userId);
    const handler = this.stepHandlers[stepIndex];

    if (handler) {
      await handler(ctx, message);
    } else {
      await this.sendError(ctx, '🧙‍♂️ Invalid step. Please start over.');
      ctx.scene.leave();
    }
  }


  private async handleStep1(ctx: BotContext, message: string) {
    const auctionName = message.trim();
    const userId = ctx.from?.id;

    if (userId && auctionName) {
      await this.updateSessionSpace(userId, { stepIndex: 2, data: { name: auctionName } });
      await ctx.reply(escapeMarkdown(`🧙‍♂️ Auction name set to "${auctionName}". What’s the auction description?`));
    } else {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid name.');
    }
  }

  private async handleStep2(ctx: BotContext, message: string) {
    const description = message.trim();
    const userId = ctx.from?.id;

    if (userId && description) {
      await this.updateSessionSpace(userId, { stepIndex: 3, data: { description } });
      await ctx.reply(escapeMarkdown('🧙‍♂️ Description saved! When should the auction start? (YYYY-MM-DD)'));
    } else {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid description.');
    }
  }

  private async handleStep3(ctx: BotContext, message: string) {
    const startDateStr = message.trim();
    const userId = ctx.from?.id;

    if (userId && startDateStr) {
      const startDate = parseISO(startDateStr);
      if (!isValid(startDate)) {
        await this.sendError(ctx, '🧙‍♂️ Invalid date format! Please provide a valid date (YYYY-MM-DD).');
        return;
      }

      await this.updateSessionSpace(userId, { stepIndex: 4, data: { startDate: startDate.toISOString() } });
      await ctx.reply(escapeMarkdown('🧙‍♂️ Start date saved! When should the auction end? (YYYY-MM-DD)'));
    } else {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid date.');
    }
  }

  private async handleStep4(ctx: BotContext, message: string) {
    const endDateStr = message.trim();
    const userId = ctx.from?.id;

    if (userId && endDateStr) {
      const endDate = parseISO(endDateStr);
      if (!isValid(endDate)) {
        await this.sendError(ctx, '🧙‍♂️ Invalid date format! Please provide a valid date (YYYY-MM-DD).');
        return;
      }

      await this.updateSessionSpace(userId, { stepIndex: 5, data: { endDate: endDate.toISOString() } });
      const session = await this.getSessionSpace(userId);

      if (!session) {
        await this.sendError(ctx, '🧙‍♂️ Session not found. Please try again.');
        return;
      }

      await this.finalizeAuctionCreation(ctx, session.last_intent_extra as CreateAuctionIntentExtra);
      await ctx.reply(escapeMarkdown('🧙‍♂️ 🎉 Auction creation complete!'));
      ctx.scene.leave();
    } else {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid date.');
    }
  }

  private async finalizeAuctionCreation(
    ctx: BotContext,
    session: CreateAuctionIntentExtra,
  ): Promise<void> {
    const { name, description, startDate, endDate } = session.data;
    if (!name || !description || !startDate || !endDate) {
      await this.sendError(ctx, '🧙‍♂️ Missing required fields to create the auction.');
      return;
    }

    const createAuctionDto: CreateAuctionDto = {
      idUser: uuid(),
      name,
      description,
      startDate,
      endDate,
    };

    try {
      const auction = await this.auctions.createAuction(createAuctionDto);
      await ctx.reply(escapeMarkdown(`🧙‍♂️ Auction created! ID: ${auction.id}`));
    } catch (error) {
      console.error('Error creating auction:', error);
      await this.sendError(ctx, '🧙‍♂️ Failed to create the auction. Please try again later.');
    }
  }

  public async updateSessionSpace(userId: number, extra: CreateAuctionIntentExtra): Promise<void> {
    const redis = await this.redisService.getRedis();
    const redisKey = `user:${userId}`;

    const currentSession = await this.getSessionSpace(userId);

    if (!currentSession) {
      console.log(`No session found for user ${userId}`);
      return;
    }

    currentSession.last_intent_extra = {
      ...currentSession.last_intent_extra,
      ...extra,
    };

    currentSession.last_intent_timestamp = new Date().toISOString();
    await redis.set(redisKey, JSON.stringify(currentSession));
  }

  private async getCurrentStepIndex(userId: number): Promise<number> {
    const session = await this.getSessionSpace(userId);
    const extra = session?.last_intent_extra as CreateAuctionIntentExtra;

    if (!extra) {
      return 0;
    }
    
    return extra.stepIndex || 0;

  }

  public async getSessionSpace(userId: number): Promise<SessionSpace | null> {
    const redis = await this.redisService.getRedis();
    const sessionStr = await redis.get(`user:${userId}`);

    if (sessionStr) {
      try {
        return JSON.parse(sessionStr) as SessionSpace;
      } catch (error) {
        console.log("Error parsing session:", error);
      }
    } else {
      console.log(`No session found for user ${userId}`);
    }

    return null;
  }

  private async sendError(ctx: BotContext, message: string) {
    await ctx.reply(escapeMarkdown(message));
  }
}
