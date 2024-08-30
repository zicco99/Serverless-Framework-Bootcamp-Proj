import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext, SessionSpace } from 'src/app.module';

export class CreateAuctionWizard {
  private readonly steps = [
    this.askForName,
    this.askForDescription,
    this.askForStartDate,
    this.askForEndDate,
  ];

  private currentStepIndex = 0;

  constructor(private readonly auctions: AuctionsService) {}

  async handleMessage(ctx: BotContext, messageText: string, userId: string) {

    // Middleware puts session space related to the user in cx.session
    const session : SessionSpace = ctx.session;
    
    if (!session.auctionCreation) {
      session.auctionCreation = {};
    }

    if (!messageText) {
      await ctx.reply("I didn't receive any text. Please try again.");
      return;
    }

    try {
      const currentStep = this.steps[this.currentStepIndex];
      await currentStep(ctx, messageText, userId, session);

      if (this.currentStepIndex < this.steps.length - 1) {
        this.currentStepIndex++;
        ctx.session.auctionCreation![userId] = session;
      } else {
        await this.finalizeAuctionCreation(ctx, userId);
        delete (ctx.session.auctionCreation![userId]);
      }
    } catch (error) {
      console.error('Error during auction creation:', error);
      await ctx.reply('An error occurred. Please try again.');
    }
  }

  private async askForName(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>) {
    if (!session.name) {
      session.name = messageText;
      await ctx.reply('Got it! Now, please provide a description for the auction.');
    }
  }

  private async askForDescription(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>) {
    if (!session.description) {
      session.description = messageText;
      await ctx.reply('Great! Now, provide the start date (YYYY-MM-DD format).');
    }
  }

  private async askForStartDate(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>) {
    if (!session.startDate) {
      const startDate = new Date(messageText);
      if (isNaN(startDate.getTime())) {
        await ctx.reply('Invalid date format. Please enter the start date in YYYY-MM-DD format.');
        return;
      }
      session.startDate = startDate;
      await ctx.reply('Nice! Now, provide the end date (YYYY-MM-DD format).');
    }
  }

  private async askForEndDate(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>) {
    if (!session.endDate) {
      const endDate = new Date(messageText);
      if (isNaN(endDate.getTime())) {
        await ctx.reply('Invalid date format. Please enter the end date in YYYY-MM-DD format.');
        return;
      }
      session.endDate = endDate;
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, userId: string) {
    const session = ctx.session.auctionCreation![userId];

    if (session.name && session.description && session.startDate && session.endDate) {
      const createAuctionDto: CreateAuctionDto = {
        name: session.name,
        description: session.description,
        startDate: session.startDate,
        endDate: session.endDate,
      };

      try {
        const auction = await this.auctions.createAuction(createAuctionDto);
        await ctx.reply(`Auction created successfully! ID: ${auction.id}`);
      } catch (error) {
        console.error('Error creating auction:', error);
        await ctx.reply('Failed to create auction. Please try again.');
      }
    } else {
      await ctx.reply('Incomplete auction details. Please start the process again.');
    }
  }
}
