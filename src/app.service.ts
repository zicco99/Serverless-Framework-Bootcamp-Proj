import { Injectable, Logger } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, Context, InjectBot, Message } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Redis } from 'ioredis';
import { AuctionWizard, CreateAuctionIntentExtra } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { escapeMarkdown } from './telegram/messages/.utils';
import { BotContext, SessionSpace } from './app.module';
import { Intent, showSessionSpace, IntentExtra } from './users/models/user.model';
import * as AWS from 'aws-sdk';

@Update()
@Injectable()
class AppService {
  private readonly logger = new Logger(AppService.name);
  private redis: Redis;
  private auctionsCounts: number;
  private readonly awsRegion = process.env.AWS_REGION;
  private readonly redisClusterId = process.env.BOT_STATE_REDIS_CLUSTER_ID;
  private readonly intentTTL = parseInt(process.env.INTENT_TTL!, 10);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctionWizard: AuctionWizard,
    private readonly auctions: AuctionsService,
  ) {
    this.initializeRedis();
    this.setupBotCommands();
  }

  private async initializeRedis() {
    this.logger.log('Connecting to AWS ElastiCache Redis Cluster...');
    const elastiCache = new AWS.ElastiCache({ region: this.awsRegion, });

    try {
      const data = await elastiCache.describeCacheClusters({
        CacheClusterId: this.redisClusterId,
        ShowCacheNodeInfo: true,
      }).promise();

      console.log("ElastiCache sent me the node endpoints: ", data);

      const nodeEndpoint = data.CacheClusters?.[0]?.CacheNodes?.[0]?.Endpoint;
      if (nodeEndpoint?.Address && nodeEndpoint?.Port) {
        const { Address: host, Port: port } = nodeEndpoint;

        console.log("Connecting to Redis: ", host, port);

        this.redis = new Redis({
          host,
          port,
        });

        this.redis.on('error', (err) => this.logger.error('Redis error:', err));
        this.redis.on('connect', () => {
          this.logger.log('Connected to Redis');
          this.auctionWizard.setRedis(this.redis);
        });

        this.logger.log(`Redis endpoint: ${host}:${port}`);
      } else {
        this.logger.error('No cache node endpoint found.');
      }
    } catch (err) {
      this.logger.error('Error fetching cache cluster info:', err);
    }
  }

  private setupBotCommands() {
    this.logger.log('Setting up bot commands...');
    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ]);
  }

  private async getUserSessionSpace(userId: number): Promise<SessionSpace | null> {
    const sessionSpace = await this.redis.get(`user:${userId}`);
    return sessionSpace ? JSON.parse(sessionSpace) : null;
  }

  private async setUserSessionSpace(userId: number, sessionSpace: SessionSpace): Promise<void> {
    await this.redis.set(`user:${userId}`, JSON.stringify(sessionSpace));
  }

  private async resetLastIntent(userId: number, sessionSpace: SessionSpace): Promise<void> {
    sessionSpace.last_intent = Intent.NONE;
    sessionSpace.last_intent_timestamp = new Date().toISOString();
    sessionSpace.last_intent_extra = {} as IntentExtra;
    await this.setUserSessionSpace(userId, sessionSpace);
  }

  private async restoreSession(session_space: SessionSpace, ctx: BotContext, userId: number, message: string): Promise<void> {
    if (session_space.last_intent !== Intent.NONE) {
      switch (session_space.last_intent) {
        case Intent.CREATE_AUCTION:
          await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, message);
          break;
        default:
          await ctx.reply("I'm not sure what to do with that. Please use the buttons or commands.");
          break;
      }
    } else {
      await ctx.reply("Your session has expired or is not valid. Please start over.");
    }
  }

  private async getUserStateOrInit(userId: number, ctx: BotContext): Promise<{ session_space: SessionSpace | null, session_newly_created: boolean }> {
    let session_space = await this.getUserSessionSpace(userId);
    const session_newly_created = !session_space;

    if (session_newly_created) {
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
          from: ctx.from
        }),
      } as SessionSpace;

      await this.setUserSessionSpace(userId, session_space);
    }

    return { session_space, session_newly_created };
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
    this.logger.log(`[${userId}][/start] -- User session space retrieved by Redis: `, session_space);

    if (!session_space) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (session_newly_created) {
      await ctx.reply(
        `👋 Welcome back buddy, right to the auction bot! Here is your user: \n${escapeMarkdown(showSessionSpace(userId, session_space))}`,
        { parse_mode: 'MarkdownV2' }
      );
    } else {
      await ctx.reply(
        `👋 👋 You are new here! Welcome buddy :)`,
        { parse_mode: 'MarkdownV2' }
      );
      this.logger.log(`[${userId}][/start] -- New user session created: `, session_space);
    }

    this.auctionsCounts ??= (await this.auctions.findAll()).length;

    const inlineKeyboard: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [Markup.button.callback('📦 Create Auction', Intent.CREATE_AUCTION)],
      [Markup.button.callback('🔍 View Auctions', Intent.VIEW_AUCTIONS)],
    ]).reply_markup as InlineKeyboardMarkup;

    this.logger.log(`[${userId}][/start] -- Welcome message sent `, session_space);
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
      await ctx.reply('Unable to load user data. Please try again.');
      return;
    }

    this.logger.log(`[${userId}][/start] -- Creating auction -> Checking if last intent is NONE: `, session_space);
    if (session_space.last_intent === Intent.NONE) {
      this.logger.log(`[${userId}][/start] -- No intent -> Creating auction: `, session_space);
      await this.auctionWizard.handleMessage(userId, Intent.CREATE_AUCTION, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, '');
    } else {
      this.logger.log(`[${userId}][/start] -- Found intent -> Restoring session: `, session_space);
      await this.restoreSession(session_space, ctx, userId, '📦 Create Auction');
    }
  }

  @Action(Intent.VIEW_AUCTIONS)
  async onViewAuctions(ctx: BotContext) {
    try {
      const auctions: Auction[] = await this.auctions.findAll();
      this.auctionsCounts = auctions.length;

      const msg = auctionListMessage(auctions);
      this.logger.log("Sending message: ", msg);

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

    if (!message) {
      await ctx.reply("🤔 I didn't receive any input. Please try again.");
      return;
    }

    const { session_space } = await this.getUserStateOrInit(userId, ctx);
    if (!session_space) {
      await ctx.reply('Unable to load user data. Please try again.');
      return;
    }

    if (session_space.last_intent === Intent.NONE) {
      await ctx.reply("You are fresh and clean, type '/show' to see cool stuff.");
      return;
    }

    const isSessionExpired = (new Date().getTime() - new Date(session_space.last_intent_timestamp).getTime()) > this.intentTTL;
    if (session_space.last_intent === Intent.CREATE_AUCTION && isSessionExpired) {
      await this.resetLastIntent(userId, session_space);
      await ctx.reply("Session has timed out. Please start the process again.");
    } else {
      await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, message);
    }
  }
}

export { AppService };
