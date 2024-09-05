import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';
import { Intent, IntentExtra } from 'src/users/models/user.model';
import { BotStateService } from 'src/services/redis/bot-state.service';
import { escapeMarkdown } from '../messages/.utils';

interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}


@Injectable()
class AuctionWizard {

  constructor(
    private readonly auctions: AuctionsService, 
    private readonly redisService: BotStateService
  ) {}

  private async validateAndUpdateField(
    ctx: BotContext,
    messageText: string,
    key: string,
    isDate: boolean,
    session: Partial<CreateAuctionDto>,
    nextStep: string = ''
  ): Promise<void> {
    if (!messageText) {
      await ctx.reply(escapeMarkdown(`🧙‍♂️ ❗ Please provide the auction's ${key}.`));
      return;
    }

    if (isDate) {
      const parsedDate = parseISO(messageText);
      if (!isValid(parsedDate)) {
        await ctx.reply(escapeMarkdown(`🧙‍♂️ ❗ Invalid date format for ${key}. Use YYYY-MM-DD format.`));
        return;
      }
      messageText = parsedDate.toISOString();
    }

    const userId = session.idUser;
    if (userId) {
      try {
        const redis = (await this.redisService.getRedis())[0];
        await redis.hset(`user_session:${userId}`, key, messageText);
        await ctx.reply(escapeMarkdown(`🧙‍♂️ 📝 Your ${key} has been set to "${messageText}".`));
        if (nextStep) {
          await ctx.reply(escapeMarkdown(`🧙‍♂️ Next, please provide the ${nextStep}.`));
        }
      } catch (error) {
        console.error('Error updating field in Redis:', error);
        await ctx.reply(escapeMarkdown('🧙‍♂️ ⚠️ There was an issue updating the field. Please try again later.'));
      }
    } else {
      await ctx.reply(escapeMarkdown('🧙‍♂️ ❗ User ID not found. Unable to update session.'));
    }
  }

  private async finalizeAuctionCreation(ctx: BotContext, session: Partial<CreateAuctionDto>): Promise<void> {
    const { idUser, name, description, startDate, endDate } = session;
    if (!idUser || !name || !description || !startDate || !endDate) {
      await ctx.reply(escapeMarkdown('🧙‍♂️ ⚠️ Incomplete auction details. Please provide all required information and try again.'));
      return;
    }

    const createAuctionDto: CreateAuctionDto = {
      idUser: idUser.toString(),
      name: name!,
      description: description!,
      startDate: startDate!,
      endDate: endDate!,
    };

    try {
      const auction = await this.auctions.createAuction(createAuctionDto);
      await ctx.reply(escapeMarkdown(`🧙‍♂️ 🎉 Your auction has been created successfully! 🆔 ID: ${auction.id}`));
    } catch (error) {
      console.error('Error creating auction:', error);
      await ctx.reply(escapeMarkdown('🧙‍♂️ 🚨 There was an issue creating the auction. Please try again later.'));
    }
  }

  async handleMessage(
    userId: number,
    intent: Intent,
    intentExtra: CreateAuctionIntentExtra,
    ctx: BotContext,
    messageText?: string,
    is_cache_restore: boolean = false
  ): Promise<void> {
    try {
      if (!messageText) {
        console.log(`[${userId}][${intent}] -- User triggered an action button with intent`, intent);
      } else {
        console.log(`[${userId}][${intent}] -- User input with intent: ${intent}, message: ${messageText}`);
      }

      const { stepIndex, data } = intentExtra;
      console.log(`[${userId}][${intent}] -- Intent Extra: ${JSON.stringify(intentExtra)}`);

      const steps = [
        { key: 'name', nextStep: 'description', isDate: false },
        { key: 'description', nextStep: 'startDate', isDate: false },
        { key: 'startDate', nextStep: 'endDate', isDate: true },
        { key: 'endDate', nextStep: '', isDate: true },
        { key: '', nextStep: '', isDate: false }
      ];


      const step = steps[stepIndex];
      console.log(`[${userId}][${intent}] -- Step: ${stepIndex}, Key: ${step?.key}, NextStep: ${step?.nextStep}, IsDate: ${step?.isDate}`);
      
      if (step) {
        if (is_cache_restore === true) {
          console.log("The intent has been restored from cache!");
          await ctx.reply(escapeMarkdown(`🧙‍♂️ We were talking about creating an auction. User: ${JSON.stringify(data.idUser)}, Auction data: ${JSON.stringify(intentExtra.data)}`));
          await ctx.reply(escapeMarkdown(`🧙‍♂️ Next, please provide the ${steps[stepIndex + 1].key}.`));
          return;
        } else {
          if (!messageText) {
            console.log(`[${userId}][${intent}] -- User started intent`, intent);
            await this.setLastIntent(userId, intent, intentExtra);
            await ctx.reply(escapeMarkdown(`🧙‍♂️ Welcome to the auction wizard! I'll guide you to create an auction. 📝 Let's start by providing the ${steps[stepIndex + 1].key}.`));
            return;
          }

          if (messageText === 'cancel') {
            await this.setLastIntent(userId, Intent.NONE);
            await ctx.reply(escapeMarkdown('🧙‍♂️ Operation cancelled. See you next time!'));
            return;
          }

          if (stepIndex < steps.length - 1) {
            await this.validateAndUpdateField(ctx, messageText, step.key, step.isDate, data, step.nextStep);
            await this.setLastIntent(userId, intent, { stepIndex: stepIndex + 1, data});
            await ctx.reply(escapeMarkdown(`🧙‍♂️ Let's continue. Now I need a ${steps[stepIndex + 1].key}.`));
          } else {
            await this.finalizeAuctionCreation(ctx, data);
            await this.setLastIntent(userId, Intent.NONE);
            await ctx.reply(escapeMarkdown('🧙‍♂️ 🎉 Your auction has been created successfully!'));
            await ctx.reply(escapeMarkdown('🧙‍♂️ Well done, peace out!'));
          }
        }
      } else {
        await ctx.reply(escapeMarkdown('🧙‍♂️ ⚠️ Invalid step index.'));
      }
    } catch (error) {
      console.error('Error during auction creation:', error);
      await ctx.reply(escapeMarkdown('🧙‍♂️ An unexpected error occurred. Please try again later.'));
      await this.setLastIntent(userId, Intent.NONE);
      await ctx.reply(escapeMarkdown('🧙‍♂️ Type /menu to go back.'));
    }
  }

  public async setLastIntent(
    userId: number, 
    intent: Intent, 
    intentExtra?: CreateAuctionIntentExtra
  ): Promise<void> {
    console.log("Setting last intent for user", userId, intent, intentExtra);

    const redisKey = `user:${userId}`;
    const redis = (await this.redisService.getRedis())[0];
  
    const timestamp = new Date().toISOString();
    const intentStr = String(intent);
  
    let lastIntentExtra = '{}';
    if (intentExtra) {
      lastIntentExtra = JSON.stringify(intentExtra);
    } else {
      switch (intent) {
        case Intent.CREATE_AUCTION:
          lastIntentExtra = JSON.stringify({ stepIndex: 0, data: {} });
          break;
        case Intent.NONE:
        default:
          lastIntentExtra = "{}";
          break;
      }
    }
  
    try {
      const currentSessionStr = await redis.get(redisKey);
      console.log(`Current session for user ${userId}: ${currentSessionStr}`);
      let currentSession: Record<string, any> = {};
  
      if (currentSessionStr) {
        currentSession = JSON.parse(currentSessionStr);
      }
  
      currentSession.last_intent = intentStr;
      currentSession.last_intent_timestamp = timestamp;
      currentSession.last_intent_extra = lastIntentExtra;
  
      await redis.set(redisKey, JSON.stringify(currentSession));
  
      console.log(`Successfully updated session for user ${userId}`);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }
  
  
}  

export { AuctionWizard, CreateAuctionIntentExtra };
