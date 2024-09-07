import { Injectable, Logger } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, InjectBot, Message, Context } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';
import { AuctionWizard, CreateAuctionIntentExtra } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { escapeMarkdown } from './telegram/messages/.utils';
import { BotContext } from './app.module';
import { Intent, showSessionSpace, getOrInitUserSessionSpace, SessionSpace } from './users/models/user.model';

@Injectable()
@Update()
export class AppService {
  private readonly log = new Logger(AppService.name);
  private auctionCount: number;
  private readonly intentTTL = 3600 * 1000;
  private readonly maxLockTTL = parseInt(process.env.SESSION_SPACE_LOCK!) || 2 * 1000;
  private lastUpdateRedis: number;
  private updateRedisInterval: number = 3 * 60 * 1000;

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctions: AuctionsService,
    private readonly redisService: RedisClusterService,
    private readonly auctionWizard: AuctionWizard
  ) {
  }

  async onModuleInit() {
    await this.redisService.initializeRedis();
    this.lastUpdateRedis = Date.now();

    setInterval(async () => {
      await this.redisService.initializeRedis();
      this.lastUpdateRedis = Date.now();
    }, this.updateRedisInterval);

    await this.redisService.getRedis();
    await this.setupCommands();
  }

  private async setupCommands() {
    this.log.log('Setting up commands...');
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Get help' },
      ]);
    } catch (error) {
      this.log.error('Failed to set up commands:', error);
    }
  }

  @Start()
  async start(ctx: BotContext) {
    console.log(`User ${ctx.from?.id} started the bot at ${new Date()}`);

    await this.gateway(ctx, async (userId, session_space) => {
      console.log("Out of gateway");
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
      console.log("Out of gateway");

      console.log("Scene joining..")
      await ctx.scene.enter('auction-wizard');
      console.log("Scene joined!")
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


  private async gateway(ctx: BotContext, post: (userId: number, session_space: SessionSpace | null, message?: string) => Promise<void>, message?: string) {
    const userId = ctx.from?.id;
    if (!userId) return ctx.reply('Unable to identify you. Please try again.', { parse_mode: 'MarkdownV2' });

    await this.redisService.handleWithLock(userId, this.maxLockTTL,
      //Auth and session check wrapper for gateway
      async () => {
        const { session_space } = await getOrInitUserSessionSpace(userId, ctx, this.auctionWizard.getSessionSpace.bind(this), this.auctionWizard.initSessionSpace.bind(this));
        if (!session_space) {
          await ctx.telegram.sendMessage(userId, "No session found. Please try again.", { parse_mode: 'MarkdownV2' });
          return;
        }

        if (session_space.last_intent !== Intent.NONE) {
          const isExpired = (Date.now() - new Date(session_space.last_intent_timestamp).getTime()) > this.intentTTL;
          if (!isExpired) {
            switch (session_space.last_intent) {
              case Intent.CREATE_AUCTION:
                await ctx.scene.enter('auction-wizard');
                return;
              case Intent.VIEW_AUCTIONS:
                await this.viewAuctions(ctx);
                return;
            }
          } else {
            await ctx.reply("Session has timed out. Cleaning up 🧹.");
            return;
          }
        }

        await post(userId, session_space, message);
    });
  }

}
