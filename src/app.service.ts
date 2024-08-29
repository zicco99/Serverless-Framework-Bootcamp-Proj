import { Injectable } from '@nestjs/common';
import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

@Injectable()
export class AppService {
  async processUpdate(update: Update): Promise<void> {
    const ctx = this.createContextFromUpdate(update);
    
    if (ctx.message) {
      if (ctx.message.text) {
        if (ctx.message.text.toLowerCase() === '/start') {
          await this.start(ctx);
        } else if (ctx.message.text.toLowerCase() === '/help') {
          await this.help(ctx);
        } else if (ctx.message.text.toLowerCase() === 'hi') {
          await this.hearsHi(ctx);
        }
      } else if (ctx.message.sticker) {
        await this.onSticker(ctx);
      }
    }
  }

  private createContextFromUpdate(update: Update): Context {
    throw new Error('createContextFromUpdate is not implemented');
  }

  async start(ctx: Context): Promise<void> {
    await ctx.reply('Welcome');
  }

  async help(ctx: Context): Promise<void> {
    await ctx.reply('Send me a sticker');
  }

  async onSticker(ctx: Context): Promise<void> {
    await ctx.reply('👍');
  }

  async hearsHi(ctx: Context): Promise<void> {
    await ctx.reply('Hey there');
  }
}
