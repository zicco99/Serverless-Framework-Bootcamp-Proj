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
  private calendar;

  constructor(private readonly auctions: AuctionsService) {
    this.calendar = new Calendar({
      locale: 'en',
      firstDayOfWeek: 1,
    });
  }

  async handleMessage(ctx: BotContext, messageText: string, userId: string) {
    console.log('Handling message : ', messageText, userId);
    console.log('Current context : ', ctx);
    console.log('Current session : ', ctx.session);

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
        this.currentStepIndex = 0;
      }

      ctx.session.auctionCreation = session.auctionCreation;
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
      if (messageText === 'Select Date') {
        await this.calendar.startNavCalendar(ctx);
      } else {
        const startDate = new Date
        if (isNaN(startDate.getTime())) {
          await ctx.reply('Invalid date format. Please enter the start date in YYYY-MM-DD format.');
          return;
        }
        session.startDate = startDate;
        await ctx.reply('Got it! Now, please provide the end date (YYYY-MM-DD format).');
      }
    }
  }

  private async askForEndDate(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>) {
    if (!session.endDate) {
      if (messageText === 'Select Date') {
        await this.calendar.startNavCalendar(ctx);
      } else {
        const endDate = new Date(messageText);
        if (isNaN(endDate.getTime())) {
          await ctx.reply('Invalid date format. Please enter the end date in YYYY-MM-DD format.');
          return;
        }
        session.endDate = endDate;
        await ctx.reply('End date selected. You can now finalize the auction.');
      }
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, userId: string) {
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
