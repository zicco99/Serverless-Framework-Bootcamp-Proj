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
import { Intent, showSessionSpace, getOrInitUserSessionSpace, resetLastIntent } from './users/models/user.model';
import { BotStateService } from './services/redis/bot-state.service';

@Update()
@Injectable()
class AppService implements OnModuleInit {
  private readonly log = new Logger(AppService.name);
  private redis: Redis[] = [];
  private auctionCount: number;
  private readonly intentTTL = parseInt(process.env.INTENT_TTL_!) || 3600 * 1000;
  private readonly lockTTL = parseInt(process.env.SESSION_SPACE_LOCK!) || 1 * 1000;

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctionWizard: AuctionWizard,
    private readonly auctions: AuctionsService,
    private readonly redisService: BotStateService
  ) {}

  async onModuleInit() {
    this.redis = await this.redisService.getRedis();
    await this.setupCommands();
  }

  private async setupCommands() {
    this.log.log('Setting up commands...');
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ]);
  }

  @Start()
  async start(ctx: BotContext) {
    console.log(`User ${ctx.from?.id} started the bot at ${new Date()}`);

    await this.gateway(ctx, async (userId, session_space) => {
      const message = session_space
        ? `👋 Welcome back! Here is your user: \n${escapeMarkdown(showSessionSpace(userId, session_space))}`
        : '👋 👋 You are new here!';
      
      await ctx.reply(message);

      this.auctionCount ??= (await this.auctions.findAll()).length;

      const inlineKeyboard: InlineKeyboardMarkup = Markup.inlineKeyboard([
        [Markup.button.callback('📦 Create Auction', Intent.CREATE_AUCTION)],
        [Markup.button.callback('🔍 View Auctions', Intent.VIEW_AUCTIONS)],
      ]).reply_markup as InlineKeyboardMarkup;

      await ctx.reply(
        welcomeMessage(ctx.from?.first_name || 'Buddy', this.auctionCount),
        { parse_mode: 'MarkdownV2', reply_markup: inlineKeyboard }
      );
    });
  }


  @Help()
  async help(ctx: BotContext) {
    await ctx.reply('Need help? Use the buttons to manage auctions or type commands to interact.');
  }

  @Action(Intent.CREATE_AUCTION)
  async createAuction(ctx: BotContext) {
    await this.gateway(ctx, async (userId, session_space) => {
      await this.auctionWizard.handleMessage(userId, Intent.CREATE_AUCTION, session_space?.last_intent_extra as CreateAuctionIntentExtra, ctx);
    });
  }

  @Action(Intent.VIEW_AUCTIONS)
  async viewAuctions(ctx: BotContext) {
    try {
      const auctions: Auction[] = await this.auctions.findAll();
      this.auctionCount = auctions.length;
      const msg = auctionListMessage(auctions);
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      this.log.error('Error retrieving auctions:', error);
      await ctx.reply('Failed to retrieve auctions. Please try again later.');
    }
  }

  // Triggered whenever user sends a message

  @Hears(/.*/)
  async onText(@Context() ctx: BotContext, @Message('text') message: string) {
    ctx.telegram.sendMessage(ctx.from?.id || 0, `AHHHH :O : ${message}`);
    await this.gateway(ctx, async (userId, session_space, message) => {
      
    });
  }

  //-------- GATEWAY -----------

async gateway(ctx: BotContext, post: (userId: number, session_space: SessionSpace | null, message?: string) => Promise<void>, message?: string){
    //Authenticate user
    const userId = ctx.from?.id;
    if (!userId) return ctx.reply('Unable to identify you\\. Please try again\\.', { parse_mode: 'MarkdownV2' });

    //Lock session space to block concurrent lambdas to avoid race conditions (consecutive messages from the same user)
    this.redisService.handleWithLock(userId, this.lockTTL, async () => {
      const { session_space } = await getOrInitUserSessionSpace(userId, ctx, this.getSession, this.setSession);

      if(!session_space) {
        ctx.telegram.sendMessage(userId,"No session found\\. Please try again\\.",{parse_mode: 'MarkdownV2'});
        return;
      }

      //If session exists, restore it (last intent)
      if(session_space.last_intent !== Intent.NONE) {
        //Check last intent
        const isExpired = (Date.now() - new Date(session_space.last_intent_timestamp).getTime()) > this.intentTTL;
        if (!isExpired) {
          //Restore last intent 
          switch (session_space.last_intent) {
            case Intent.CREATE_AUCTION:
              await this.auctionWizard.handleMessage(userId, session_space.last_intent, session_space.last_intent_extra as CreateAuctionIntentExtra, ctx, message);
              return;
            case Intent.VIEW_AUCTIONS:
              await this.viewAuctions(ctx);
              return;
          }
        } 
        else {
          await resetLastIntent(userId, this.redis[0]);
          await ctx.reply("Session has timed out\\. Cleaning up 🧹\\.");
          await new Promise(resolve => setTimeout(resolve, 1000));
          await ctx.reply("Type /menu to get started.\\.");
          return;
        }
      }
      //Execute user action
      await post(userId, session_space, message);
    });
  }



  //-------- HELPERS -----------

  private async getSession(userId: number): Promise<SessionSpace | null> {
    const session = await this.redis[0].get(`user:${userId}`);
    return session ? JSON.parse(session) : null;
  }

  private async setSession(userId: number, session: SessionSpace): Promise<void> {
    await this.redis[0].set(`user:${userId}`, JSON.stringify(session));
  }
}

export { AppService };
