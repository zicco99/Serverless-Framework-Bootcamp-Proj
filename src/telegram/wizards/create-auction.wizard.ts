import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';
import { Intent, IntentExtra } from 'src/users/models/user.model';
import { Redis } from 'ioredis';
import { BotStateService } from 'src/services/redis/bot-state.service';
import { escapeMarkdown } from '../messages/.utils';

interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

const prefixIntentData = 'data';

@Injectable()
class AuctionWizard {

  constructor(
    private readonly auctions: AuctionsService, 
    private readonly redisService: BotStateService
  ) {}

  private async validateAndUpdateField(
    ctx: BotContext,
    messageText: string,
    prefix: string,
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
        await redis.hset(`user_session:${userId}:${prefix}`, key, messageText);
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

      let { stepIndex = 0, data = {} } = intentExtra;

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

          await this.validateAndUpdateField(ctx, messageText, prefixIntentData, step.key, step.isDate, data, step.nextStep);
          if (stepIndex < steps.length - 1) {
            intentExtra.stepIndex = stepIndex + 1;
            await this.setLastIntent(userId, intent, intentExtra);
            await ctx.reply(escapeMarkdown(`🧙‍♂️ Let's continue. Now I need a ${steps[stepIndex + 1].key}.`));
          } else {
            await this.finalizeAuctionCreation(ctx, data);
            // Reset last intent
            await this.setLastIntent(userId, Intent.CREATE_AUCTION);
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
    intentExtra: CreateAuctionIntentExtra = { stepIndex: 0, data: {} }
  ): Promise<void> {
    const redisKey = `user_session:${userId}`;
    const redis = (await this.redisService.getRedis())[0];
  
    try {
      // Prepare transaction
      const transaction = redis.multi();
      console.log(`Setting last_intent to ${intent}`);
      transaction.hset(redisKey, 'last_intent', intent);

      const timestamp = new Date().toISOString();
      console.log(`Setting last_intent_timestamp to ${timestamp}`);
      transaction.hset(redisKey, 'last_intent_timestamp', timestamp);
  
      // Determine and set intent extra
      let lastIntentExtra: string;
      if (intentExtra) {
        lastIntentExtra = JSON.stringify(intentExtra);
        console.log(`Setting last_intent_extra to ${lastIntentExtra}`);
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
      transaction.hset(redisKey, 'last_intent_extra', lastIntentExtra);
  
      // Execute transaction
      const result = await transaction.exec();
      console.log(`Redis transaction result: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error('Error setting last intent:', error);
      throw error;
    }
  }
}  

export { AuctionWizard, CreateAuctionIntentExtra };
