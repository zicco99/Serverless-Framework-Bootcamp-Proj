import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, InjectBot, Message, Context } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Redis } from 'ioredis';
import Redlock from 'redlock';
import { AuctionWizard, CreateAuctionIntentExtra } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { escapeMarkdown } from './telegram/messages/.utils';
import { BotContext, SessionSpace } from './app.module';
import { Intent, showSessionSpace, IntentExtra } from './users/models/user.model';
import { BotStateService } from './services/redis/bot-state.service';

@Update()
@Injectable()
class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private redisClients: Redis[] = [];
  private auctionsCounts: number;
  private readonly intentTTL = parseInt(process.env.INTENT_TTL_!, 3600*1000);
  private readonly sessionSpaceLock = parseInt(process.env.SESSION_SPACE_LOCK!, 1000);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctionWizard: AuctionWizard,
    private readonly auctions: AuctionsService,
    private readonly redisService: BotStateService
  ) {}

  async onModuleInit() {
    this.redisClients = await this.redisService.getRedis();
    this.setupBotCommands();
  }
  setupBotCommands() {
    throw new Error('Method not implemented.');
  }

  private async getUserSessionSpace(userId: number): Promise<SessionSpace | null> {
    const sessionSpace = await this.redisClients[0].get(`user:${userId}`);
    return sessionSpace ? JSON.parse(sessionSpace) : null;
  }

  private async setUserSessionSpace(userId: number, sessionSpace: SessionSpace): Promise<void> {
    await this.redisClients[0].set(`user:${userId}`, JSON.stringify(sessionSpace));
  }

  private async resetLastIntent(userId: number): Promise<void> {
    const redisKey = `user_session:${userId}`;

    const pipeline = this.redisClients[0].pipeline();
    pipeline.hset(redisKey, 'last_intent', Intent.NONE);
    pipeline.hset(redisKey, 'last_intent_timestamp', new Date().toISOString());
    pipeline.hset(redisKey, 'last_intent_extra', JSON.stringify({}));

    try {
      await pipeline.exec();
    } catch (error) {
      this.logger.error('Error resetting last intent:', error);
      throw error;
    }
  }
  
  @Start()
  async startCommand(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    this.logger.log(`[${userId}][/start] -- User started the bot`);
    const { session_space, session_newly_created } = await this.getUserStateOrInit(userId, ctx);

    if (!session_space) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (!session_newly_created) {
      await ctx.reply(
        `👋 Welcome back buddy, right to the auction bot! Here is your user: \n${escapeMarkdown(showSessionSpace(userId, session_space))}`,
        { parse_mode: 'MarkdownV2' }
      );
    } else {
      await ctx.reply(`👋 👋 You are new here!`, { parse_mode: 'MarkdownV2' });
    }

    this.auctionsCounts ??= (await this.auctions.findAll()).length;

    const inlineKeyboard: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [Markup.button.callback('📦 Create Auction', Intent.CREATE_AUCTION)],
      [Markup.button.callback('🔍 View Auctions', Intent.VIEW_AUCTIONS)],
    ]).reply_markup as InlineKeyboardMarkup;

    await ctx.reply(
      welcomeMessage(ctx.from?.first_name || 'Buddy', this.auctionsCounts),
      { parse_mode: 'MarkdownV2', reply_markup: inlineKeyboard }
    );
  }

  @Help()
  async helpCommand(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }
    await ctx.reply('Need help? Use the buttons to manage auctions or type commands to interact.');
  }

  @Action(Intent.CREATE_AUCTION)
  async onCreateAuction(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    const { session_space } = await this.getUserStateOrInit(userId, ctx);

    if (!session_space) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (session_space.last_intent === Intent.NONE) {
      await this.auctionWizard.handleMessage(userId, Intent.CREATE_AUCTION, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, '');
    } else {
      await this.restoreSession(session_space, ctx, userId, '📦 Create Auction');
    }
  }

  @Action(Intent.VIEW_AUCTIONS)
  async onViewAuctions(ctx: BotContext) {
    try {
      const auctions: Auction[] = await this.auctions.findAll();
      this.auctionsCounts = auctions.length;

      const msg = auctionListMessage(auctions);
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      this.logger.error('Error retrieving auctions:', error);
      await ctx.reply('Failed to retrieve auctions. Please try again later.');
    }
  }

  @Hears(/.*/)
  async onText(@Context() ctx: BotContext, @Message('text') message: string) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    this.redisService.handleWithLock(userId,this.sessionSpaceLock, async () => {
      const { session_space } = await this.getUserStateOrInit(userId, ctx);

    if (session_space?.last_intent === Intent.CREATE_AUCTION) {
      const isSessionExpired = (new Date().getTime() - new Date(session_space.last_intent_timestamp).getTime()) > this.intentTTL;
      if (isSessionExpired) {
        await this.resetLastIntent(userId);
        await ctx.reply("Session has timed out. Wait a second, cleaning around 🧹.");
      } else {
        await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, message);
      }
    }
    })
  }

  private async getUserStateOrInit(userId: number, ctx: BotContext): Promise<{ session_space: SessionSpace | null, session_newly_created: boolean }> {
    let session_space = await this.getUserSessionSpace(userId);
    const session_newly_created = session_space === null;

    if (!session_space) {
      session_space = {
        chatId: ctx.chat?.id || 0,
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
        firstInteraction: new Date().toISOString(),
        languageCode: ctx.from?.language_code || '',
        last_intent: Intent.NONE,
        last_intent_extra: {} as IntentExtra,
        last_intent_timestamp: "",
        initialContext: JSON.stringify({
          chat: ctx.chat,
          message: ctx.message,
          from: ctx.from,
        }),
      };

      await this.setUserSessionSpace(userId, session_space);
    }

    return { session_space, session_newly_created };
  }

  private async restoreSession(session_space: SessionSpace, ctx: BotContext, userId: number, message: string): Promise<void> {
    if (session_space.last_intent === Intent.CREATE_AUCTION) {
      await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, message);
    } else {
      await ctx.reply("Your session has expired or is not valid. Please start over.");
    }
  }
}

export { AppService };
