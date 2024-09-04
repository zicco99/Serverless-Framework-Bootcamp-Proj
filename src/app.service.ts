import { Injectable } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, Message, Context, InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Cluster } from "ioredis";
import { AuctionWizard, CreateAuctionIntentExtra } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { escapeMarkdown } from './telegram/messages/.utils';
import { BotContext, SessionSpace } from './app.module';
import { Intent, showSessionSpace, IntentExtra } from './users/models/user.model';

@Update()
@Injectable()
class AppService {
  private auctionsCounts: number | null = null;
  private redis: Cluster;

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctionWizard: AuctionWizard,
    private readonly auctions: AuctionsService,
  ) {

    const host = "rediss://" + process.env.BOT_STATE_REDIS_ADDRESS;
    const port = +process.env.BOT_STATE_REDIS_PORT!;

    console.log("Connecting to Redis Cluster... redis://", process.env.BOT_STATE_REDIS_ADDRESS, ":", process.env.BOT_STATE_REDIS_PORT);
    
    this.redis = new Cluster([{ host, port }],{
      dnsLookup: (address, callback) => callback(null, address),
      slotsRefreshTimeout: 2000,
      redisOptions: {
        tls: {}
      },
    });

    this.redis.on('error', (err: Error) => {
      console.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
      auctionWizard.setRedis(this.redis);
    });

    console.log("Setting up bot commands...");
    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ]);

    //Attach redis to auctionWizard
    auctionWizard.setRedis(this.redis);
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
      await ctx.reply('Unable to identify you\\. Please try again\\.');
      return;
    }

    console.log(`[${userId}][/start] -- User started the bot`);
    const { session_space, session_newly_created } = await this.getUserStateOrInit(userId, ctx);
    console.log(`[${userId}][/start] -- User session space retrieved by Redis: `, session_space);

    if (!session_space) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (session_newly_created) {
      await ctx.reply(
        `👋 Welcome back buddy, right to the auction bot \\! Here is your user: \n${escapeMarkdown(showSessionSpace(userId, session_space))}`,
        { parse_mode: 'MarkdownV2' }
      );
      return;
    } else {
      await ctx.reply(
        `👋 👋 You are new here \\! Welcome buddy :)`,
        { parse_mode: 'MarkdownV2' }
      );
      console.log(`[${userId}][/start] -- New user session created: `, session_space);
    }

    this.auctionsCounts ??= (await this.auctions.findAll()).length;

    const inlineKeyboard: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [Markup.button.callback('📦 Create Auction', Intent.CREATE_AUCTION)],
      [Markup.button.callback('🔍 View Auctions', Intent.VIEW_AUCTIONS)],
    ]).reply_markup as InlineKeyboardMarkup;

    console.log(`[${userId}][/start] -- Welcome message sent `, session_space);
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

    console.log(`[${userId}][/start] -- Creating auction -> Checking if last intent is NONE: `, session_space);
    if (session_space.last_intent === Intent.NONE) {
      console.log(`[${userId}][/start] -- No intent -> Creating auction: `, session_space);
      await this.auctionWizard.handleMessage(userId, Intent.CREATE_AUCTION, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, '');
    } else {
      console.log(`[${userId}][/start] -- Found intent -> Restoring session: `, session_space);
      await this.restoreSession(session_space, ctx, userId, '📦 Create Auction');
    }
  }

  @Action(Intent.VIEW_AUCTIONS)
  async onViewAuctions(ctx: BotContext) {
    try {
      const auctions: Auction[] = await this.auctions.findAll();
      this.auctionsCounts = auctions.length;

      const msg = auctionListMessage(auctions);
      console.log("Sending message: ", msg);

      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error retrieving auctions:', error);
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

    const intentTTL = parseInt(process.env.INTENT_TTL!, 10);
    if (session_space.last_intent === Intent.CREATE_AUCTION) {
      const init_ts = session_space.last_intent_timestamp;
      if (init_ts && (new Date().getTime() - new Date(init_ts).getTime()) > intentTTL) {
        session_space.last_intent = Intent.NONE;
        session_space.last_intent_timestamp = new Date().toISOString();
        session_space.last_intent_extra = {} as IntentExtra;

        await this.setUserSessionSpace(userId, session_space);
        await ctx.reply("Session has timed out. Please start the process again.");
      } else {
        await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, message);
      }
    } else {
      await ctx.reply("I'm not sure what to do with that. Use the buttons to manage auctions or type commands.");
    }
  }
}

export { AppService };
