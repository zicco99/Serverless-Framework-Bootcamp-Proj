import { Body, Controller, Get, Post } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';

@Controller()
export class AppController {
  private bot: Telegraf<Context>;

  constructor() {
    this.bot = new Telegraf(process.env.BOT_TELEGRAM_KEY || '');
  }
  @Post()
  async handleWebhook(@Body() body: any): Promise<void> {
    await this.bot.handleUpdate(body);
  }
}
