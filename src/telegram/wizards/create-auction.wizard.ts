import { Injectable } from '@nestjs/common';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { parseISO, isValid } from 'date-fns';
import { Intent, IntentExtra } from 'src/users/models/user.model';
import { Cluster } from 'ioredis';

interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

@Injectable()
class AuctionWizard {
  private redis: Cluster;

  constructor(private readonly auctions: AuctionsService) {}

  setRedis(redis: Cluster) {
    this.redis = redis;
  }

  private readonly createAuctionSteps = [
    this.askString('name', 'description'),
    this.askString('description', 'startDate'),
    this.askDate('startDate', 'endDate'),
    this.askDate('endDate', ''),
    this.finalizeAuctionCreation.bind(this)
  ];

  private async updateRedisField(userId: string, key: string, value: any): Promise<void> {
    try {
      const redisKey = `user_session:${userId}`;
      await this.redis.hset(redisKey, `data:${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Error updating Redis:', error);
    }
  }
  

  private async getRedisField(userId: number, key: string): Promise<string | null> {
    try {
      const redisKey = `user_session:${userId}`;
      const value = await this.redis.hget(redisKey, `data:${key}`);
      return value || null;
    } catch (error) {
      console.error('Error getting Redis field:', error);
      return null;
    }
  }

  private askString(key: string, nextInfo: string) {
    return async (ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>) => {
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

  private askDate(key: string, nextInfo: string) {
    return async (ctx: BotContext, messageText: string, session: Partial<CreateAuctionDto>) => {
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
        await ctx.reply(`❗ The date format for ${key} is invalid. Please use YYYY-MM-DD format.`);
      }
    };
  }

  private async finalizeAuctionCreation(ctx: BotContext, _: string, session: Partial<CreateAuctionDto>): Promise<void> {
    if (!session.idUser || !session.name || !session.description || !session.startDate || !session.endDate) {
      await ctx.reply('⚠️ Incomplete auction details. Please provide all required information and try again.');
      return;
    }

    const createAuctionDto: CreateAuctionDto = {
      idUser: session.idUser.toString(),
      name: session.name!,
      description: session.description!,
      startDate: session.startDate!,
      endDate: session.endDate!,
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
    if (!messageText) {
      await ctx.reply("🤔 It looks like you didn't enter any text. Please try again.");
      return;
    }

    switch (intent) {
      case Intent.CREATE_AUCTION:
        let stepIndex = intentExtra.stepIndex || 0;
        try {
          const currentStep = this.createAuctionSteps[stepIndex];
          await currentStep(ctx, messageText, intentExtra.data);

          if (stepIndex < this.createAuctionSteps.length - 1) {
            intentExtra.stepIndex = ++stepIndex;
          } else {
            await this.finalizeAuctionCreation(ctx, '', intentExtra.data);
          }
        } catch (error) {
          console.error('Error during auction creation:', error);
          await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
        }
        break;

      default:
        await ctx.reply("⚠️ I don't recognize that command. Please use the correct one.");
        break;
    }
  }
}

export { AuctionWizard, CreateAuctionIntentExtra };
