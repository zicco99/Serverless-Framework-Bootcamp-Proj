import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';

interface AuctionWizardState {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

@Injectable()
export class CreateAuctionWizardManager {

  private readonly userWizards = new Map<string, AuctionWizardState>();

  private readonly steps = [
    this.askForName.bind(this),
    this.askForDescription.bind(this),
    this.askForStartDate.bind(this),
    this.askForEndDate.bind(this),
  ];

  constructor(private readonly auctions: AuctionsService) {}

  async handleMessage(ctx: BotContext, messageText: string, userId: string): Promise<void> {
    console.log('Handling message:', { messageText, userId });

    if (!messageText) {
      await ctx.reply("🤔 I didn't receive any input. Please try again.");
      return;
    }

    if (messageText === '/cancel') {
      this.userWizards.delete(userId);
      await ctx.reply('❌ Auction creation has been cancelled.');
      return;
    }

    //Obtain user's current state
    let wizardState = this.userWizards.get(userId);

    if (!wizardState) {
      wizardState = { stepIndex: 0, data: {} };
      this.userWizards.set(userId, wizardState);
    }

    //Execute step and increment step index
    try {
      const currentStep = this.steps[wizardState.stepIndex];
      await currentStep(ctx, messageText, wizardState.data);

      if (wizardState.stepIndex < this.steps.length - 1) {
        wizardState.stepIndex++;
      } else {
        await this.finalizeAuctionCreation(ctx, userId);
        this.userWizards.delete(userId);
        delete ctx.session.auctionCreation
      }
    } catch (error) {
      console.error('Error during auction creation:', error);
      await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
    }
  }


  // Define steps functions

  private async askForName(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<void> {
    session.name = messageText;
    await ctx.reply('📝 Auction name recorded. Please provide a description for the auction.');
  }

  private async askForDescription(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<void> {
    session.description = messageText;
    await ctx.reply('✏️ Description noted. What is the start date of the auction? Please use YYYY-MM-DD format.');
  }

  private async askForStartDate(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<void> {
    const parsedDate = parseISO(messageText);
    if (isValid(parsedDate)) {
      session.startDate = parsedDate.toISOString();
      await ctx.reply('📅 Start date set. Now, please provide the end date (YYYY-MM-DD format).');
    } else {
      await ctx.reply('❗ Invalid date format. Please enter the start date in YYYY-MM-DD format.');
    }
  }

  private async askForEndDate(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<void> {
    const parsedDate = parseISO(messageText);
    if (isValid(parsedDate)) {
      session.endDate = parsedDate.toISOString();
      await ctx.reply('✅ End date recorded.');
    } else {
      await ctx.reply('❗ Invalid date format. Please enter the end date in YYYY-MM-DD format.');
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, userId: string): Promise<void> {
    const wizardState = this.userWizards.get(userId);
    if (wizardState) {
      const session = wizardState.data as CreateAuctionDto;
      session.idUser = userId;

      if (session.name && session.description && session.startDate && session.endDate) {
        const createAuctionDto: CreateAuctionDto = { ...session };

        try {
          const auction = await this.auctions.createAuction(createAuctionDto);
          await ctx.reply(`🎉 Auction created successfully! 🆔 ID: ${auction.id}`);
        } catch (error) {
          console.error('Error creating auction:', error);
          await ctx.reply('🚨 Failed to create auction. Please try again later.');
        }
      } else {
        await ctx.reply('⚠️ Incomplete auction details. Please start the process again.');
      }
    }
  }
}
