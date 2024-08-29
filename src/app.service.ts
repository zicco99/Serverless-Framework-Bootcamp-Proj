import { Injectable, Logger } from '@nestjs/common';
import { Start, On, Ctx, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  @Start()
  async handleStart(
    @Ctx() ctx: Context,
    @Message('text') msg: string,
  ) {
    this.logger.log('Received /start command:', msg);
    await ctx.reply('Welcome to the bot!');
  }

  @On('text')
  async handleText(
    @Ctx() ctx: Context,
    @Message('text') msg: string,
  ) {
    this.logger.log('Received text message:', msg);
    await ctx.reply('Received text message');
  }

}