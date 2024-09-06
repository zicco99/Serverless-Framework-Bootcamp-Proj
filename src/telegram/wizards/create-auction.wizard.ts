import { Injectable } from '@nestjs/common';
import { Wizard, WizardStep, Ctx, Message } from 'nestjs-telegraf';
import { AuctionsService } from 'src/auctions/auctions.service';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { BotContext } from 'src/app.module';
import { RedisClusterService } from 'src/services/redis/bot-state.service';
import { escapeMarkdown } from '../messages/.utils';
import { parseISO, isValid } from 'date-fns';
import { IntentExtra } from 'src/users/models/user.model';
import { v4 as uuid } from 'uuid';

interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

@Injectable()
@Wizard('auction-wizard')
export class AuctionWizard {
  constructor(
    private readonly auctions: AuctionsService,
    private readonly redisService: RedisClusterService,
  ) {}

  @WizardStep(1)
  async step1(@Ctx() ctx: BotContext) {
    await ctx.reply(escapeMarkdown('🧙‍♂️ Welcome! Let’s create your auction. What’s the auction name?'));
    await this.updateSession(ctx.from?.id!, { stepIndex: 1 });
  }

  @WizardStep(2)
  async step2(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const auctionName = message;
    const userId = ctx.from?.id;

    if (userId && auctionName) {
      // Save the auction name in the session
      await this.updateSession(userId, { stepIndex: 2, data: { name: auctionName } });
      await ctx.reply(escapeMarkdown(`🧙‍♂️ Auction name set to "${auctionName}". What’s the auction description?`));
      ctx.wizard.next(); // Move to the next step
    } else {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Please provide a valid name.'));
    }
  }

  @WizardStep(3)
  async step3(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const description = message;
    const userId = ctx.from?.id;

    if (userId && description) {
      // Save the description in the session
      await this.updateSession(userId, { stepIndex: 3, data: { description } });
      await ctx.reply(escapeMarkdown(`🧙‍♂️ Description saved! When should the auction start? (YYYY-MM-DD)`));
      ctx.wizard.next(); // Move to the next step
    } else {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Please provide a valid description.'));
    }
  }

  @WizardStep(4)
  async step4(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const startDateStr = message;
    const userId = ctx.from?.id;

    if (userId && startDateStr) {
      const startDate = parseISO(startDateStr);
      if (!isValid(startDate)) {
        await ctx.reply(escapeMarkdown('🧙‍♂️ Invalid date format! Please provide a valid date (YYYY-MM-DD).'));
        return;
      }

      await this.updateSession(userId, { stepIndex: 4, data: { startDate: startDate.toISOString() } });
      await ctx.reply(escapeMarkdown('🧙‍♂️ Start date saved! When should the auction end? (YYYY-MM-DD)'));
      ctx.wizard.next(); // Move to the next step
    } else {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Please provide a valid date.'));
    }
  }

  @WizardStep(5)
  async step5(@Ctx() ctx: BotContext, @Message('text') message: string) {
    const endDateStr = message;
    const userId = ctx.from?.id;

    if (userId && endDateStr) {
      const endDate = parseISO(endDateStr);
      if (!isValid(endDate)) {
        await ctx.reply(escapeMarkdown('🧙‍♂️ Invalid date format! Please provide a valid date (YYYY-MM-DD).'));
        return;
      }

      await this.updateSession(userId, { stepIndex: 5, data: { endDate: endDate.toISOString() } });

      const session = await this.getUserSession(userId);
      await this.finalizeAuctionCreation(ctx, session.last_intent_extra?.data || {});

      await ctx.reply(escapeMarkdown('🧙‍♂️ 🎉 Auction creation complete!'));
      ctx.scene.leave(); // End the wizard
    } else {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Please provide a valid date.'));
    }
  }

  private async getUserSession(userId: number): Promise<any> {
    const redis = (await this.redisService.getRedis())[0];
    const redisKey = `user:${userId}`;
    const sessionStr = await redis.get(redisKey);
    return sessionStr ? JSON.parse(sessionStr) : {};
  }

  private async updateSession(userId: number, extra: Partial<CreateAuctionIntentExtra>): Promise<void> {
    const redis = (await this.redisService.getRedis())[0];
    const redisKey = `user:${userId}`;
    const currentSession = await this.getUserSession(userId);

    if (!currentSession.last_intent_extra) {
      currentSession.last_intent_extra = {};
    }

    currentSession.last_intent_extra = { ...currentSession.last_intent_extra, ...extra };
    await redis.set(redisKey, JSON.stringify(currentSession));
  }

  private async finalizeAuctionCreation(
    ctx: BotContext,
    session: Partial<CreateAuctionDto>,
  ): Promise<void> {
    const { name, description, startDate, endDate } = session;
    if (!name || !description || !startDate || !endDate) {
      await ctx.reply(escapeMarkdown('🧙‍♂️ Missing required fields to create the auction.'));
      return;
    }

    const createAuctionDto: CreateAuctionDto = {
      idUser: uuid(),
      name,
      description,
      startDate,
      endDate,
    };

    try {
      const auction = await this.auctions.createAuction(createAuctionDto);
      await ctx.reply(escapeMarkdown(`🧙‍♂️ Auction created! ID: ${auction.id}`));
    } catch (error) {
      console.error('Error creating auction:', error);
      await ctx.reply(escapeMarkdown('🧙‍♂️ Failed to create the auction. Please try again later.'));
    }
  }
}
