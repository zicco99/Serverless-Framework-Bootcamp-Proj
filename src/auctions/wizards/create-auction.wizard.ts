import { Scene, SceneEnter, On, Ctx, Message, SceneLeave } from 'nestjs-telegraf';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/users/models/user.model';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';
import { escapeMarkdown } from 'src/telegram/messages/.utils';
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

function logWithPrefix(scene: string, userId: number | undefined, message: string, level: 'info' | 'error' = 'info') {
  const prefix = `[${scene}][${userId ?? 'unknown'}]`;
  console[level](`${prefix} ${message}`);
}

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
    const userId = ctx.from?.id!;
    
    await ctx.reply(escapeMarkdown('🧙‍♂️ Welcome! Let’s create your auction. What’s the auction name?'));
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const userId = ctx.from?.id;

    if (!message) {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid text.');
      return;
    }

    if (message === 'cancel') {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Auction creation canceled.'));
      ctx.scene.leave();
      return;
    }

    if (!userId) {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid user ID.');
      return;
    }

    logWithPrefix('auction-wizard', userId, `Received text: ${message}`);

    let session = await this.getSessionSpace(userId);

    if (!session) {
      await this.sendError(ctx, '🧙‍♂️ Session not found. Please try again.');
      return;
    }

    const { stepIndex } = session.last_intent_extra as CreateAuctionIntentExtra;

    if(stepIndex === 5) {
      await this.finalizeAuctionCreation(ctx, session.last_intent_extra as CreateAuctionIntentExtra);
    }

    // Step handler selection
    const handler = this.stepHandlers[stepIndex];

    if (handler) {
      await handler(ctx, message);
    } else {
      await this.sendError(ctx, '🧙‍♂️ Invalid step. Please start over.');
      ctx.scene.leave();
    }
  }


  // Steps handlers

  private async handleStep1(ctx: BotContext, message: string) {
    const auctionName = message.trim();
    const userId = ctx.from?.id;

    logWithPrefix('auction-wizard', userId, `Handling Step 1: Name - ${auctionName}`);
    
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

    logWithPrefix('auction-wizard', userId, `Handling Step 2: Description - ${description}`);
    
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

    logWithPrefix('auction-wizard', userId, `Handling Step 3: Start Date - ${startDateStr}`);
    
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

    logWithPrefix('auction-wizard', userId, `Handling Step 4: End Date - ${endDateStr}`);
    
    if (userId && endDateStr) {
      const endDate = parseISO(endDateStr);
      if (!isValid(endDate)) {
        await this.sendError(ctx, '🧙‍♂️ Invalid date format! Please provide a valid date (YYYY-MM-DD).');
        return;
      }

      const session = await this.getSessionSpace(userId);

      if (!session) {
        await this.sendError(ctx, '🧙‍♂️ Session not found. Please try again.');
        return;
      }

      const last_intent_extra: CreateAuctionIntentExtra = {
        ...session.last_intent_extra,
        stepIndex: 5,
        data: {
            ...session.last_intent_extra.data,
            endDate: endDate.toISOString(),
        }
      };

      if(await this.finalizeAuctionCreation(ctx, last_intent_extra) === true) {
        await ctx.reply(escapeMarkdown('🧙‍♂️ 🎉 Auction creation complete!'));
        ctx.scene.leave();
        return;
      }

      await this.updateSessionSpace(userId, last_intent_extra);
      await ctx.reply(escapeMarkdown('🧙‍♂️ You tried but did not work, im gonna save the data and lo again\\.'));

    } else {
      await this.sendError(ctx, '🧙‍♂️ Please provide a valid date.');
    }
  }

  private async finalizeAuctionCreation(
    ctx: BotContext,
    session: CreateAuctionIntentExtra,
  ): Promise<boolean> {
    const { name, description, startDate, endDate } = session.data;
    const userId = ctx.from?.id;
    
    logWithPrefix('auction-wizard', userId, `Finalizing auction creation. Data: ${JSON.stringify(session.data)}`);
    
    if (!name || !description || !startDate || !endDate) {
      await this.sendError(ctx, '🧙‍♂️ Missing required fields to create the auction.');
      return false;
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
      logWithPrefix('auction-wizard', userId, `Auction created with ID: ${auction.id}`);
      return true;
    } catch (error: any) {
      logWithPrefix('auction-wizard', userId, `Error creating auction: ${error.message}`, 'error');
      await this.sendError(ctx, '🧙‍♂️ Failed to create the auction. Please try again later.');
      return false;
    }
  }

  // Manage Session Space

  public async initSessionSpace(userId: number, session: SessionSpace): Promise<SessionSpace> {
    const redis = await this.redisService.getRedis();
    const redisKey = `user:${userId}`;
    const sessionStr = JSON.stringify(session);

    logWithPrefix('auction-wizard', userId, `Creating session space for user [${userId}] with data: ${sessionStr}`);

    await redis.set(redisKey, sessionStr);
    return session;
  }

  public async updateSessionSpace(userId: number, extra: CreateAuctionIntentExtra): Promise<void> {
    const redis = await this.redisService.getRedis();
    const redisKey = `user:${userId}`;

    logWithPrefix('auction-wizard', userId, `Updating session space with data: ${JSON.stringify(extra)}`);

    const currentSession = await this.getSessionSpace(userId);

    if (!currentSession) {
      logWithPrefix('auction-wizard', userId, `No session found to update.`);
      return;
    }

    currentSession.last_intent_extra = {
      ...currentSession.last_intent_extra,
      ...extra,
    };

    currentSession.last_intent_timestamp = new Date().toISOString();
    await redis.set(redisKey, JSON.stringify(currentSession));
  }

  public async getSessionSpace(userId: number): Promise<SessionSpace | null> {
    const redis = await this.redisService.getRedis();
    const sessionStr = await redis.get(`user:${userId}`);

    logWithPrefix('auction-wizard', userId, `Getting session space. SessionSpace: ${sessionStr}`);
    
    if (sessionStr) {
      try {
        return JSON.parse(sessionStr) as SessionSpace;
      } catch (error: any) {
        logWithPrefix('auction-wizard', userId, `Error parsing session: ${error.message}`, 'error');
      }
    } else {
      logWithPrefix('auction-wizard', userId, `No session found.`);
    }

    return null;
  }

  public async entertainUserWhileWaiting(ctx: any, timeToWait: number): Promise<number> {
    const initialMessage = await ctx.reply(escapeMarkdown('🧙‍♂️ Welcome! Wait some time...'));
  
    const messages = [
      'Casting spells... ✨',
      'Conjuring magic... 🌀',
      'Summoning the ancient forces... 🔮',
      'Almost there... 🧙‍♂️',
    ];
  
    const timePerMessage = Math.floor(timeToWait / messages.length);
    for (let i = 0; i < messages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, timePerMessage));
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          initialMessage.message_id,
          undefined,
          escapeMarkdown(messages[i])
        );
      } catch (error) {
        console.error('Failed to edit message:', error);
        break;
      }
    }

    return initialMessage.message_id;

  }
  

  private async sendError(ctx: BotContext, message: string) {
    await ctx.reply(escapeMarkdown(message));
  }
}
