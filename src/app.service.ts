import { Injectable, Logger } from '@nestjs/common';
import { Start, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  @Start()
  async handleStart(ctx: Context) {
    this.logger.log('Received /start command:', ctx.update);
    await ctx.reply('Welcome to the bot!');
  }

  @On('text')
  async handleText(ctx: Context) {
    this.logger.log('Received text message:', ctx.update);
    await ctx.reply('Received text message');
  }

}