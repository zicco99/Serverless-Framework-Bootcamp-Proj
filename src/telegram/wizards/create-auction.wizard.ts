import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';

@Injectable()
export class CreateAuctionWizardManager {
  private readonly steps = [
    this.askForName.bind(this),
    this.askForDescription.bind(this),
    this.askForStartDate.bind(this),
    this.askForEndDate.bind(this),
  ];

  constructor(private readonly auctions: AuctionsService) {}

  async handleMessage(ctx: BotContext, messageText: string, userId: string): Promise<void> {
    if (messageText === '/cancel') {
      const botMessage = await ctx.reply('❌ Auction creation has been cancelled.');
      await this.clearConversation(ctx,  ctx.msg.message_id, botMessage.message_id);
      return;
    }

    if (!messageText) {
      const botMessage = await ctx.reply("🤔 I didn't receive any input. Please try again.");
      await this.clearConversation(ctx,  ctx.msg.message_id, botMessage.message_id);
      return;
    }

    let stepIndex = 0;
    const session: Partial<CreateAuctionDto> = {};

    try {
      while (stepIndex < this.steps.length) {
        const botMessage = await this.steps[stepIndex](ctx, messageText, session);
        await this.clearConversation(ctx, ctx.msg.message_id, botMessage.message_id);
        stepIndex++;
        if (stepIndex < this.steps.length) {
          break;
        }
      }

      if (stepIndex >= this.steps.length) {
        // Ensure all required properties are defined
        if (this.isCompleteAuctionDto(session)) {
          const createAuctionDto: CreateAuctionDto = session as CreateAuctionDto;

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
    } catch (error) {
      const botMessage = await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
      await this.clearConversation(ctx, ctx.msg.message_id, botMessage.message_id);
    }
  }

  private async askForName(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<any> {
    session.name = messageText;
    return ctx.reply('📝 Auction name recorded. Please provide a description for the auction.');
  }

  private async askForDescription(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<any> {
    session.description = messageText;
    return ctx.reply('✏️ Description noted. What is the start date of the auction? Please use YYYY-MM-DD format.');
  }

  private async askForStartDate(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<any> {
    const parsedDate = parseISO(messageText);
    if (isValid(parsedDate)) {
      session.startDate = parsedDate.toISOString();
      return ctx.reply('📅 Start date set. Now, please provide the end date (YYYY-MM-DD format).');
    } else {
      return ctx.reply('❗ Invalid date format. Please enter the start date in YYYY-MM-DD format.');
    }
  }

  private async askForEndDate(ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<any> {
    const parsedDate = parseISO(messageText);
    if (isValid(parsedDate)) {
      session.endDate = parsedDate.toISOString();
      return ctx.reply('✅ End date recorded.');
    } else {
      return ctx.reply('❗ Invalid date format. Please enter the end date in YYYY-MM-DD format.');
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, session: Partial<CreateAuctionDto>): Promise<any> {
    if (session.name && session.description && session.startDate && session.endDate) {
      const createAuctionDto: CreateAuctionDto = session as CreateAuctionDto;

      try {
        const auction = await this.auctions.createAuction(createAuctionDto);
        return ctx.reply(`🎉 Auction created successfully! 🆔 ID: ${auction.id}`);
      } catch (error) {
        console.error('Error creating auction:', error);
        return ctx.reply('🚨 Failed to create auction. Please try again later.');
      }
    } else {
      return ctx.reply('⚠️ Incomplete auction details. Please start the process again.');
    }
  }

  private isCompleteAuctionDto(dto: Partial<CreateAuctionDto>): dto is CreateAuctionDto {
    return !!(dto.name && dto.description && dto.startDate && dto.endDate);
  }

  private async clearConversation(ctx: BotContext, userMessageId: number, botMessageId: number): Promise<void> {
    try {
      // Delete the user's message
      await ctx.deleteMessage(userMessageId);

      // Delete the bot's message
      await ctx.deleteMessage(botMessageId);

      console.log('Messages deleted successfully.');
    } catch (error) {
      console.error('Error deleting messages:', error);
    }
  }
}
