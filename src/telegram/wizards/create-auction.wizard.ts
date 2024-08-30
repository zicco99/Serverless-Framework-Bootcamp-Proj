import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext, SessionSpace } from 'src/app.module';
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
    console.log('Handling message:', messageText, userId);

    let wizardState = this.userWizards.get(userId);

    if (!wizardState) {
      wizardState = {
        stepIndex: 0,
        data: {},
      };
      this.userWizards.set(userId, wizardState);
    }

    if (!messageText) {
      await ctx.reply("I didn't receive any text. Please try again.");
      return;
    }

    try {
      const stepFunction = this.steps[wizardState.stepIndex];
      await stepFunction(ctx, messageText, userId, wizardState.data);

      if (wizardState.stepIndex < this.steps.length - 1) {
        wizardState.stepIndex++;
      } else {
        // Final step
        await this.finalizeAuctionCreation(ctx, userId);
        this.userWizards.delete(userId);  // Clear the wizard state for this user
      }
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
    if (!session.startDate) {
      console.log("Received start date input:", messageText);
      const parsedDate = parseISO(messageText);

      if (isValid(parsedDate)) {
        session.startDate = parsedDate.toISOString();
        await ctx.reply('Got it! Now, provide the end date (YYYY-MM-DD format).');
      } else {
        await ctx.reply('Invalid date format. Please provide the start date in YYYY-MM-DD format.');
      }
    }
  }

  private async askForEndDate(ctx: BotContext, messageText: string, userId: string, session: Partial<CreateAuctionDto>): Promise<void> {
    if (!session.endDate) {
      console.log("Received end date input:", messageText);
      const parsedDate = parseISO(messageText);

      if (isValid(parsedDate)) {
        session.endDate = parsedDate.toISOString();
      } else {
        await ctx.reply('Invalid date format. Please provide the end date in YYYY-MM-DD format.');
      }
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, userId: string): Promise<void> {
    const wizardState = this.userWizards.get(userId);

    if (wizardState) {
      const session = wizardState.data as CreateAuctionDto;

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
}
