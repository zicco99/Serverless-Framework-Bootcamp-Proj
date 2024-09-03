import { Injectable } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, Message, Context, InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { BotContext } from './app.module';
import { CreateAuctionWizardManager } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';
import { welcomeMessage } from './telegram/messages/welcome';
import { auctionListMessage } from './telegram/messages/auction';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { UsersService } from './users/users.service';
import { CreateUserDto } from './users/dtos/create-user.dto';
import { escapeMarkdown } from './telegram/messages/.utils';
import { showUser, User } from './users/models/user.model';

@Update()
@Injectable()
class AppService {
  constructor(@InjectBot() private readonly bot: Telegraf<BotContext>,private readonly auctionWizardManager: CreateAuctionWizardManager, private readonly auctions: AuctionsService, private readonly users: UsersService) {
    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ]);

  }

  private auctionsCounts : number | null = null;

  @Start()
  async startCommand(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    let user = this.users.findUser(userId);
    if (!user) {
      console.log("Creating user [", userId, "] using context: ", ctx);

      const createUserDto: CreateUserDto = {
        userId,
        chatId: ctx.chat!.id,
        username: ctx.from!.username || '',
        firstName: ctx.from!.first_name,
        lastName: ctx.from!.last_name || '',
        languageCode: ctx.from!.language_code || 'EN',
      };

    await ctx.reply(
      `👋 Welcome to the auction bot! Here is your user: \n${escapeMarkdown(showUser(user))}`,
      { parse_mode: 'MarkdownV2' }
    );

    // Lazy-load auction counts
    this.auctionsCounts ??= (await this.auctions.findAll()).length;

    // Define inline keyboard
    const inlineKeyboard: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [Markup.button.callback('📦 Create Auction', 'CREATE_AUCTION')],
      [Markup.button.callback('🔍 View Auctions', 'VIEW_AUCTIONS')],
    ]).reply_markup as InlineKeyboardMarkup;

    await ctx.reply(
      welcomeMessage(ctx.from?.first_name || 'Buddy', this.auctionsCounts),
      { parse_mode: 'MarkdownV2', reply_markup: inlineKeyboard }
    );
    }
  }



  @Help()
  async helpCommand(ctx: BotContext) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (ctx.session.auctionCreation) {
      await ctx.reply('You are already creating an auction. Please continue with the auction creation process.');
      return;
    }

    await ctx.reply('Need help? Use the buttons to manage auctions or type commands to interact.');
  }

  @Action('CREATE_AUCTION')
  async onCreateAuction(ctx: BotContext) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    //Create intent space for auction creation
    ctx.session.auctionCreation = ctx.session.auctionCreation || {};

    await ctx.reply('Let’s create a new auction! Please provide the name of the auction.');
  }

  @Action('VIEW_AUCTIONS')
  async onViewAuctions(ctx: BotContext) {
    try {
      const auctions : Auction[] = await this.auctions.findAll();
      this.auctionsCounts = auctions.length

      const msg = auctionListMessage(auctions)
      console.log("Sending message: ", msg);

      await ctx.reply(msg,{ parse_mode : 'MarkdownV2' });
    } catch (error) {
      console.error('Error retrieving auctions:', error);
      await ctx.reply('Failed to retrieve auctions. Please try again later.');
    }
  }

  @Hears(/.*/)
  async onText(@Context() ctx: BotContext,@Message('text') message: string) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    if (!message) {
      await ctx.reply("🤔 I didn't receive any input. Please try again.");
      return;
    }

    if (ctx.session.auctionCreation) {
      await this.auctionWizardManager.handleMessage(ctx, message, userId);
      return;
    }

    await ctx.reply("I'm not sure what to do with that. Use the buttons to manage auctions.");
  }
}

export { AppService, BotContext };

