import { Inject, Injectable } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, Message, Context, InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { AuctionWizard, CreateAuctionIntentExtra } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { escapeMarkdown } from './telegram/messages/.utils';
import { ClientProxy } from '@nestjs/microservices';
import { BotContext, SessionSpace } from './app.module';
import { Intent, showSessionSpace, IntentExtra } from './users/models/user.model';

@Update()
@Injectable()
class AppService {
  private auctionsCounts: number | null = null;

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctionWizard: AuctionWizard,
    private readonly auctions: AuctionsService,
    @Inject('BOT_CACHE_CLIENT_REDIS') private readonly redis: ClientProxy,
  ) {
    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ]);

    this.redis.connect();
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

    return { session_space , session_newly_created };
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

    if(!session_space) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (session_newly_created) {
      await ctx.reply(
        `👋 Welcome back buddy, right to the auction bot \\! Here is your user: \n${escapeMarkdown(showSessionSpace(userId, session_space))}`,
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }else { 
      await ctx.reply(
      `👋 👋 You are new here \\! Welcome buddy :)`,
      { parse_mode: 'MarkdownV2' });
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

    if(!session_space) {
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
    if(!session_space) {
      await ctx.reply('Unable to load user data. Please try again.');
      return;
    }

    if (session_space.last_intent === Intent.NONE) {
      await ctx.reply("You are fresh and clean, type '/show' to see cool stuff.");
      return;
    }

    const intentTTL = parseInt(process.env.INTENT_TTL!);
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
      await ctx.reply("I'm not sure what to do with that. Use the buttons to manage auctions.");
    }
  }


  // Load user session from Redis + Session restore mechanism

  private async getUserSessionSpace(userId: number): Promise<SessionSpace | null> {
    const session_space = await this.redis.send('get_user', { userId }).toPromise();
    return session_space ? JSON.parse(session_space) as SessionSpace : null;
  }

  private async setUserSessionSpace(userId: number, session_space: SessionSpace): Promise<void> {
    await this.redis.send('set_user', { userId, session_space: JSON.stringify(session_space) }).toPromise();
  }

  private async resetLastIntent(userId: number, session_space: SessionSpace): Promise<void> {
    session_space.last_intent = Intent.NONE;
    session_space.last_intent_timestamp = new Date().toISOString();
    session_space.last_intent_extra = {} as IntentExtra;
    await this.setUserSessionSpace(userId, session_space);
  }

  private async restoreSession(session_space: SessionSpace, ctx: BotContext, userId: number, message: string): Promise<void> {
    if (session_space.last_intent !== Intent.NONE) {
      switch (session_space.last_intent) {
        case Intent.CREATE_AUCTION:
          await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as  CreateAuctionIntentExtra, ctx, message);
          break;
      }
    }
  }
}

export { AppService, BotContext };

