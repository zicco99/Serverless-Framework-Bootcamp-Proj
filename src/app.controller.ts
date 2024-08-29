import { Body, Controller, Post } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';

@Controller()
export class AppController {
  constructor(private readonly bot: Telegraf<Context>) {}

  @Post('/webhook')
  async handleWebhook(@Body() body: any): Promise<void> {
    try {
      await this.bot.handleUpdate(body);
    } catch (error) {
      console.error('Failed to handle webhook update:', error);
    }
  }
}
