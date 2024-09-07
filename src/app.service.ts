import { Injectable, Logger } from '@nestjs/common';
import { Help, Start, Update, Action, InjectBot, Message, Context } from 'nestjs-telegraf';
import { Markup,Telegraf } from 'telegraf';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { escapeMarkdown } from './telegram/messages/.utils';
import { BotContext } from './users/models/user.model';
import { Intent, showSessionSpace } from './users/models/user.model';


@Injectable()
@Update()
export class AppService {
  private readonly log = new Logger(AppService.name);
  private auctionCount: number;
  private lastUpdateRedis: number;
  private updateRedisInterval: number = 3 * 60 * 1000;

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly auctions: AuctionsService,
    private readonly redisService: RedisClusterService,
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
        { command: 'menu', description: 'Get menu' },
        { command: 'help', description: 'Get help' },
      ]);
    } catch (error) {
      this.log.error('Failed to set up commands:', error);
    }
  }

  @Start()
  async start(ctx: BotContext) {
    const userId = ctx.from?.id!;

    console.log(`User ${userId} started the bot at ${new Date()}`);

    const message = `👋 Welcome back! Here is your user: \n${escapeMarkdown(showSessionSpace(userId, ctx.session_space))}`
    
    await ctx.reply(message);

    this.auctionCount ??= (await this.auctions.findAll()).length;

    const inlineKeyboard: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [Markup.button.callback('📦 Create Auction', Intent.CREATE_AUCTION)],
      [Markup.button.callback('🔍 View Auctions', Intent.VIEW_AUCTIONS)],
    ]).reply_markup as InlineKeyboardMarkup;

    await ctx.reply(
      welcomeMessage(ctx.from?.first_name || 'Buddy', this.auctionCount),
      { parse_mode: 'MarkdownV2', reply_markup: inlineKeyboard });
  }

  @Help()
  async help(ctx: BotContext) {
    await ctx.reply('Need help? Use the buttons to manage auctions or type commands to interact.');
  }

  @Action(Intent.CREATE_AUCTION)
  async createAuction(ctx: BotContext) {
    console.log("Scene joining..")
    await ctx.scene.enter('auction-wizard');
    console.log("Scene joined!")
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

}
