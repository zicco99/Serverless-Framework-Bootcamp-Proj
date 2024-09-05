import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';
import { Intent, IntentExtra, resetLastIntent } from 'src/users/models/user.model';
import { Redis } from 'ioredis';
import { BotStateService } from 'src/services/redis/bot-state.service';
import { escapeMarkdown } from '../messages/.utils';

interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

@Injectable()
class AuctionWizard {
  redis: Redis;

  constructor(private readonly auctions: AuctionsService, private readonly redisService: BotStateService) {
  }


  private async updateRedisField(userId: string, key: string, value: any): Promise<void> {
    try {
      const redisKey = `user_session:${userId}`;
      await this.redis.hset(redisKey, `data:${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Error updating Redis:', error);
    }
  }

  private async validateAndUpdateField(
    ctx: BotContext,
    messageText: string,
    key: string,
    isDate: boolean,
    session: Partial<CreateAuctionDto>,
    nextStep: string = ''
  ): Promise<void> {

    if (!messageText) {
      await ctx.reply(`❗ Please provide the auction's ${key}.`);
      return;
    }
  
    if (isDate) {
      const parsedDate = parseISO(messageText);
      if (!isValid(parsedDate)) {
        await ctx.reply(`❗ Invalid date format for ${key}. Use YYYY-MM-DD format.`);
        return;
      }
      messageText = parsedDate.toISOString();
    }
  
    const userId = session.idUser;
    if (userId) {
      await this.updateRedisField(userId, key, messageText);
      await ctx.reply(`📝 Your ${key} has been set to "${messageText}".`);
      if (nextStep) {
        await ctx.reply(`Next, please provide the ${nextStep}.`);
      }
    } else {
      await ctx.reply('❗ User ID not found. Unable to update session.');
    }
  }
  
  private async finalizeAuctionCreation(ctx: BotContext, session: Partial<CreateAuctionDto>): Promise<void> {
    const { idUser, name, description, startDate, endDate } = session;
    if (!idUser || !name || !description || !startDate || !endDate) {
      await ctx.reply('⚠️ Incomplete auction details. Please provide all required information and try again.');
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
      await ctx.reply(`🎉 Your auction has been created successfully! 🆔 ID: ${auction.id}`);
    } catch (error) {
      console.error('Error creating auction:', error);
      await ctx.reply('🚨 There was an issue creating the auction. Please try again later.');
    }
  }

  // Action trigger + User input trigger
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
      } else{
        console.log(`[${userId}][${intent}] -- User input with intent: ${intent}, message: ${messageText}`);
      }

      const { stepIndex = 0, data = {} } = intentExtra;

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
        
        if(is_cache_restore === true){
          console.log("The intent has been restored from cache! ");
          await ctx.reply(escapeMarkdown(`We were talking about creating an auction, actually I got this data User: ${JSON.stringify(data.idUser)} Auction data: ${JSON.stringify(intentExtra.data)}`));
          await ctx.reply(`Next, please provide the ${steps[stepIndex + 1].key}\\.`);
          return;
        }
        else {
          if (!messageText || stepIndex === 0) {
            console.log(`[${userId}][${intent}] -- User started intent`, intent);
            await ctx.reply(`🧙‍♂️ - Welcome to the auction wizard\\! I'll guide to create an auction.\\. Hum ... 📝, let's start by its ${steps[stepIndex + 1].key}\\.`);
            return;
          }

          if(messageText === 'cancel'){
            await ctx.reply('🧙‍♂️ - Operation cancelled, cya buddy');
            return;
          }

          await this.validateAndUpdateField(ctx, messageText, step.key, step.isDate, data, step.nextStep);

          if (stepIndex < steps.length - 1) {
            intentExtra.stepIndex = stepIndex + 1;
            await ctx.reply(`Next, please provide the ${steps[stepIndex + 1].key}.`);
          } else {
            await this.finalizeAuctionCreation(ctx, data);
            await this.resetLastIntent(userId, data);
            await ctx.reply('🎉 Your auction has been created successfully!');
        }
      }
      } else {
        await ctx.reply('⚠️ Invalid step index.');
      }
    } catch (error) {
      console.error('Error during auction creation:', error);
      await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
      resetLastIntent(userId, (await this.redisService.getRedis())[0]);
      await ctx.reply('Type /menu to go back');
    }
  }


  public async resetLastIntent(userId: number, data: Partial<CreateAuctionDto>): Promise<void> {
    const redisKey = `user_session:${userId}`;

    // Pipeline to gain atomicity
    const pipeline = this.redis.pipeline();
    
    pipeline.hset(redisKey, 'last_intent', Intent.NONE);
    pipeline.hset(redisKey, 'last_intent_timestamp', new Date().toISOString());
    pipeline.hset(redisKey, 'last_intent_extra', JSON.stringify({ stepIndex: 0, data }));
    
    try {
      await pipeline.exec(); 
    } catch (error) {
      console.error('Error resetting last intent:', error);
      throw error; 
    }
  }
}

export { AuctionWizard, CreateAuctionIntentExtra };
