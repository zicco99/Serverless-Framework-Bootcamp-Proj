import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext, SessionSpace } from 'src/app.module';
import Calendar from 'telegram-inline-calendar';

export class CreateAuctionWizard {
  private readonly steps = [
    this.askForName.bind(this),
    this.askForDescription.bind(this),
    this.askForStartDate.bind(this),
    this.askForEndDate.bind(this),
  ];

  private currentStepIndex = 0;
  private calendar: Calendar;

  constructor(private readonly auctions: AuctionsService) {
    this.calendar = new Calendar({
      locale: 'en',
      firstDayOfWeek: 1,
    });
  }

  async handleMessage(ctx: BotContext, messageText: string, userId: string): Promise<void> {
    console.log('Handling message:', messageText, userId);
    console.log('Current context:', ctx);
    console.log('Current session:', ctx.session);

    const session: SessionSpace = ctx.session;

    if (!session.auctionCreation) {
      session.auctionCreation = {};
    }

    if (!messageText) {
      await ctx.reply("I didn't receive any text. Please try again.");
      return;
    }

    try {
      const stepFunction = this.steps[this.currentStepIndex];
      await stepFunction(ctx, messageText, userId, session.auctionCreation);

      if (this.currentStepIndex < this.steps.length - 1) {
        this.currentStepIndex++;
      } else {
        await this.finalizeAuctionCreation(ctx, userId);
        delete ctx.session.auctionCreation;
        this.currentStepIndex = 0; // Reset for next use
      }

      ctx.session.auctionCreation = session.auctionCreation;
    } catch (error) {
      console.error('Error during auction creation:', error);
      await ctx.reply('An error occurred. Please try again.');
    }
  }

  private async askForName(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>): Promise<void> {
    if (!session.name) {
      session.name = messageText;
      await ctx.reply('Got it! Now, please provide a description for the auction.');
    }
  }

  private async askForDescription(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>): Promise<void> {
    if (!session.description) {
      session.description = messageText;
      await ctx.reply('Great! Now, provide the start date (YYYY-MM-DD format).');
    }
  }

  private async askForStartDate(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>): Promise<void> {
    console.log(messageText);
    if (!session.startDate) {
        await this.calendar.startNavCalendar(ctx);
    }
  }

  private async askForEndDate(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>): Promise<void> {
    console.log(messageText);
    if (!session.endDate) {
        await this.calendar.startNavCalendar(ctx);
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, userId: string): Promise<void> {
    const session = ctx.session.auctionCreation as CreateAuctionDto;

    if (session.name && session.description && session.startDate && session.endDate) {
      const createAuctionDto: CreateAuctionDto = { ...session };

      try {
        const auction = await this.auctions.createAuction(createAuctionDto);
        await ctx.reply(`Auction created successfully! ID: ${auction.id}`);
      } catch (error) {
        console.error('Error creating auction:', error);
        await ctx.reply('Failed to create auction. Please try again later.');
      }
    } else {
      await ctx.reply('Incomplete auction details. Please start the process again.');
    }
  }
}
