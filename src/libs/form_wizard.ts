import { Scene, SceneEnter, On, Ctx, Message } from 'nestjs-telegraf';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/users/models/user.model';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';
import { escapeMarkdown } from 'src/telegram/messages/.utils';
import { parseISO, isValid } from 'date-fns';
import { IntentExtra, SessionSpace } from 'src/users/models/user.model';
import { v4 as uuid } from 'uuid';
import { Logger } from '@nestjs/common';

export interface WizardFormSteps {
  [step_number: number]: (
    ctx: BotContext,
    message: string,
    validate: (message: string) => boolean,
    step_index: number,
    key: string,
    next_key: string
  ) => Promise<void>;
}

export interface WizardFormInfo {
  key: string;
  message: string;
  validate: (message: string) => boolean;
  required: boolean;
  type: 'string' | 'number' | 'date';
  }

const logger = new Logger('AuctionWizard');

export class FormWizard<T extends IntentExtra> {
  private stepHandlers: WizardFormSteps = {};

  constructor(
    public redis: RedisClusterService,
    public INIT_EXTRA: T,
    form_infos: WizardFormInfo[]
  ) {
    form_infos.forEach((form_info, index) => {
      this.stepHandlers[index] = this.handleStep.bind(this, form_info.type);
    });
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.reply(escapeMarkdown('🧙‍♂️ Welcome! Let’s create your auction. What’s the auction name?'));

    const redis = await this.redis.getRedis();
    const redisKey = `commands_set:${userId}`;
    const commandsSet = await redis.get(redisKey);

    if (!commandsSet) {
      await ctx.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'menu', description: 'Get menu' },
        { command: 'help', description: 'Get help' },
      ]);
      await redis.set(redisKey, 'true', 'EX', 86400); // Cache for 24 hours
    }
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const userId = ctx.from?.id;
    if (!message || !userId) return;

    if (await this.debounce(ctx)) return; // Debounce rapid input

    if (message === '/cancel') {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Auction creation canceled.'));
      await this.updateSessionSpace(userId, this.INIT_EXTRA);
      ctx.scene.leave();
      return;
    }

    logger.log(`[auction-wizard][User: ${userId}] Received text: ${message}`);

    const session = await this.getSessionSpace(userId);
    if (!session) return this.sendError(ctx, '🧙‍♂️ Session not found. Please start over.', userId, 'Session missing for user.');

    const { data } = session.last_intent_extra as T;
    const step = data.stepIndex;
    if (step === 5) {
      const success = true;
      if (success) {
        await ctx.reply(escapeMarkdown('🧙‍♂️ 🎉 Auction creation complete!'));
        await this.updateSessionSpace(userId, this.INIT_EXTRA);
        ctx.scene.leave();
      } else {
        this.sendError(ctx, '🧙‍♂️ There was an issue completing the auction. Please try again.', userId, 'Auction finalization error.');
      }
      return;
    }

    const handler = this.stepHandlers[step];
    if (handler) {
      await handler(
        ctx,
        message,
        session.last_intent_extra.data[session.last_intent_extra.data[step]],
        step,
        session.last_intent_extra.data[step],
        session.last_intent_extra.data[step + 1]
      );
    } else {
      await this.sendError(ctx, '🧙‍♂️ Invalid step. Please start over.', userId, 'Invalid step handler.');
      ctx.scene.leave();
    }
  }

  private async handleStep(
    type: 'string' | 'number' | 'date',
    ctx: BotContext,
    message: string,
    validate: (message: string) => boolean,
    step_index: number,
    key: string,
    next_key: string
  ) {
    const userId = ctx.from?.id;
    const userInput = message.trim();

    if (userId && userInput && this.validateInput(type, userInput)) {
      const newIntentExtra = { ...ctx.session_space.last_intent_extra.data };
      newIntentExtra.stepIndex = step_index + 1;
      newIntentExtra[key] = userInput;

      if (type === 'date' && !isValid(parseISO(userInput))) {
        return this.sendError(ctx, '🧙‍♂️ Invalid date format! Please provide a valid date (YYYY-MM-DD).');
      }

      await this.updateSessionSpace(userId, newIntentExtra);
      await ctx.reply(escapeMarkdown(`🧙‍♂️ Got it! It's ${next_key}'s turn.`));
    } else {
      await this.sendError(ctx, `🧙‍♂️ Please provide a valid ${key}.`);
    }
  }

  private validateInput(type: 'string' | 'number' | 'date', value: string): boolean {
    if (type === 'string') {
      return value.length > 0;
    }
    if (type === 'number') {
      return !isNaN(Number(value));
    }
    if (type === 'date') {
      return isValid(parseISO(value));
    }
    return false;
  }

  private async updateSessionSpace(userId: number, extra: T): Promise<void> {
    const redis = await this.redis.getRedis();
    const redisKey = `user:${userId}`;
    const session = await this.getSessionSpace(userId);

    if (session) {
      session.last_intent_extra = { ...session.last_intent_extra, ...extra };
      session.last_intent_timestamp = new Date().toISOString();

      const pipeline = redis.pipeline();
      pipeline.set(redisKey, JSON.stringify(session));
      await pipeline.exec();
    }
  }

  private async getSessionSpace(userId: number): Promise<SessionSpace<T> | null> {
    const redis = await this.redis.getRedis();
    const sessionStr = await redis.get(`user:${userId}`);

    if (sessionStr) {
      try {
        return JSON.parse(sessionStr) as SessionSpace<T>;
      } catch (error: any) {
        logger.error(`[auction-wizard][User: ${userId}] Error parsing session: ${error.message}`);
      }
    }

    return null;
  }

  private async sendError(ctx: BotContext, message: string, userId?: number, logMessage?: string) {
    if (userId && logMessage) {
      logger.error(`[auction-wizard][User: ${userId}] ${logMessage}`);
    }
    await ctx.reply(escapeMarkdown(message));
  }

  private async debounce(ctx: BotContext): Promise<boolean> {
    const redis = await this.redis.getRedis();
    const key = `debounce:${ctx.from?.id}`;
    const isDebounced = await redis.get(key);
    if (isDebounced) {
      await this.sendError(ctx, '🧙‍♂️ Please wait before sending another command.');
      return true;
    }
    await redis.set(key, 'true', 'EX', 2); // 2-second debounce
    return false;
  }

  public async entertainUserWhileWaiting(ctx: any, timeToWait: number): Promise<void> {
    const initialMessage = await ctx.reply(escapeMarkdown('🧙‍♂️ Hang tight...'));

    const messages = [
      'Casting spells... ✨',
      'Conjuring magic... 🌀',
      'Summoning ancient forces... 🔮',
      'Almost there... 🧙‍♂️',
    ];

    const timePerMessage = Math.floor(timeToWait / messages.length);
    for (const msg of messages) {
      await new Promise(resolve => setTimeout(resolve, timePerMessage));
      try {
        if (ctx.scene?.isLeaving()) break;
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          initialMessage.message_id,
          undefined,
          escapeMarkdown(msg)
        );
      } catch (error : any) {
        logger.error(`Failed to edit message for user ${ctx.from?.id}: ${error.message}`);
        break;
      }
    }
  }
}
