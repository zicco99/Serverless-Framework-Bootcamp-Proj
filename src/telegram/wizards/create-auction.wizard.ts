import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';
import { Intent, IntentExtra } from 'src/users/models/user.model';
import { Redis } from 'ioredis';

interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

interface StepFunction {
  (ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>): Promise<void>;
}

@Injectable()
class AuctionWizard {
  private redis: Redis;
  private readonly steps: Map<number, StepFunction>;

  constructor(private readonly auctions: AuctionsService) {
    this.steps = new Map<number, StepFunction>([
      [0, this.askFor('name', 'description')],
      [1, this.askFor('description', 'startDate')],
      [2, this.askForDate('startDate', 'endDate')],
      [3, this.askForDate('endDate', '')],
      [4, this.finalizeAuctionCreation.bind(this)],
    ]);
  }

  setRedis(redis: Redis) {
    this.redis = redis;
  }

  private async updateRedisField(userId: string, key: string, value: any): Promise<void> {
    try {
      const redisKey = `user_session:${userId}`;
      await this.redis.hset(redisKey, `data:${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Error updating Redis:', error);
    }
  }

  private async getRedisField(userId: string, key: string): Promise<string | null> {
    try {
      const redisKey = `user_session:${userId}`;
      return await this.redis.hget(redisKey, `data:${key}`) || null;
    } catch (error) {
      console.error('Error getting Redis field:', error);
      return null;
    }
  }

  private askFor(key: string, nextInfo: string = ''): StepFunction {
    return async (ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>) => {
      if (!messageText) {
        await ctx.reply(`❗ Please provide the auction's ${key}.`);
        return;
      }

      const userId = session.idUser;
      if (userId) {
        await this.updateRedisField(userId, key, messageText);
        await ctx.reply(`📝 Your ${key} has been set to "${messageText}".`);
        if (nextInfo) {
          await ctx.reply(`Next, please provide the ${nextInfo}.`);
        }
      } else {
        await ctx.reply('❗ User ID not found. Unable to update session.');
      }
    };
  }

  private askForDate(key: string, nextInfo: string): StepFunction {
    return async (ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>) => {
      if (!messageText) {
        await ctx.reply('❗ Please provide a valid date for ' + key + ' (YYYY-MM-DD).');
        return;
      }

      const parsedDate = parseISO(messageText);
      if (isValid(parsedDate)) {
        const userId = session.idUser;
        if (userId) {
          await this.updateRedisField(userId, key, parsedDate.toISOString());
          await ctx.reply(`📅 Your ${key} has been set to "${parsedDate.toISOString()}".`);
          if (nextInfo) {
            await ctx.reply(`Next, please provide the ${nextInfo}.`);
          }
        } else {
          await ctx.reply('❗ User ID not found. Unable to update session.');
        }
      } else {
        await ctx.reply(`❗ Invalid date format for ${key}. Use YYYY-MM-DD format.`);
      }
    };
  }

  private async finalizeAuctionCreation(ctx: BotContext, _: string, session: Partial<CreateAuctionDto>): Promise<void> {
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

  async handleMessage(
    userId: number,
    intent: Intent,
    intentExtra: CreateAuctionIntentExtra,
    ctx: BotContext,
    messageText: string
  ): Promise<void> {
    if (intent !== Intent.CREATE_AUCTION) {
      await ctx.reply("⚠️ I don't recognize that command. Please use the correct one.");
      return;
    }

    const { stepIndex = 0, data = {} } = intentExtra;
    if (stepIndex === 0) {
      console.log(`User [${userId}] started the auction creation wizard.`);
      await ctx.telegram.sendMessage(userId, "Give me the name of your auction:");
    }

    console.log(`Processing auction creation, step: ${stepIndex}`);
    try {
      const stepFunction = this.steps.get(stepIndex);
      if (stepFunction) {
        await stepFunction(ctx, messageText, data);
        if (stepIndex < this.steps.size - 1) {
          intentExtra.stepIndex = stepIndex + 1;
          await this.handleMessage(userId, intent, intentExtra, ctx, '');
        } else {
          await this.finalizeAuctionCreation(ctx, '', data);
        }
      } else {
        await ctx.reply('⚠️ Invalid step index.');
      }
    } catch (error) {
      console.error('Error during auction creation:', error);
      await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
    }
  }
}

export { AuctionWizard, CreateAuctionIntentExtra };