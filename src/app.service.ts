import { Injectable } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, Message, Context, InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { BotContext } from './app.module';
import { CreateAuctionWizardManager } from './telegram/wizards/create-auction.wizard';
import { AuctionsService } from './auctions/auctions.service';
import { Auction } from './auctions/models/auction.model';

@Update()
@Injectable()
class AppService {
  constructor(@InjectBot() private readonly bot: Telegraf<BotContext>,private readonly auctionWizardManager: CreateAuctionWizardManager, private readonly auctions: AuctionsService) {
    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
    ]);

  }

  private auctionsCounts : number | null = null;

  @Start()
  async startCommand(ctx: BotContext) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    //Retrieve stats:
    if (!this.auctionsCounts) this.auctionsCounts = (await this.auctions.findAll()).length

    await ctx.reply(welcomeMessage(ctx.from?.first_name || "Buddy", this.auctionsCounts),{ parse_mode : 'MarkdownV2' });
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
      
      if (auctions.length === 0) {
        await ctx.reply('No open auctions at the moment.');
      } else {
        for (const auction of auctions) {
          await ctx.reply(`Auction ID: ${auction.id}\nName: ${auction.name}\nStatus: ${auction.status}\nEnd Date: ${auction.endDate}`);
        }
      }
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

    if (ctx.session.auctionCreation) {
      await this.auctionWizardManager.handleMessage(ctx, message, userId);
      return;
    }

    await ctx.reply("I'm not sure what to do with that. Use the buttons to manage auctions.");
  }
}

export { AppService, BotContext };

