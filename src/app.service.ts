import { Injectable } from '@nestjs/common';
import { Hears, Help, Start, Update, Action, Message, Context } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { AuctionsService } from './auctions/auctions.service';
import { CreateAuctionWizard } from './telegram/wizards/create-auction.wizard';
import { BotContext } from './app.module';

@Update()
@Injectable()
class AppService {
  private createAuctionWizard: CreateAuctionWizard;

  constructor(private readonly auctions: AuctionsService) {
    this.createAuctionWizard = new CreateAuctionWizard(auctions);
  }

  @Start()
  async startCommand(ctx: BotContext) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }
    // Initialize session if not present
    ctx.session.auctionCreation = ctx.session.auctionCreation || {};

    const buttons = Markup.inlineKeyboard([
      Markup.button.callback('Create Auction', 'CREATE_AUCTION'),
      Markup.button.callback('View Auctions', 'VIEW_AUCTIONS'),
      Markup.button.callback('Show Help', 'SHOW_HELP'),
    ]);

    await ctx.reply('Hello there! 🖖 Ready to manage some auctions? Use the buttons below to interact.', buttons);
  }

  @Help()
  async helpCommand(ctx: BotContext) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    ctx.session.auctionCreation = ctx.session.auctionCreation || {};

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

    // Initialize session if not present
    ctx.session.auctionCreation = ctx.session.auctionCreation || {};

    await ctx.reply('Let’s create a new auction! Please provide the name of the auction.');
  }

  @Action('VIEW_AUCTIONS')
  async onViewAuctions(ctx: BotContext) {
    try {
      const auctions = await this.auctions.findAll();
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

  @Hears(/.*/) // Any input
  async onText(@Context() ctx: BotContext,@Message('text') message: string) {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply('Unable to identify you. Please try again.');
      return;
    }

    // Initialize session if not present
    ctx.session.auctionCreation = ctx.session.auctionCreation || {};

    if (ctx.session.auctionCreation) {
      await this.createAuctionWizard.handleMessage(ctx, message, userId);
      return;
    }

    await ctx.reply("I'm not sure what to do with that. Use the buttons to manage auctions.");
  }
}

export { AppService, BotContext };

