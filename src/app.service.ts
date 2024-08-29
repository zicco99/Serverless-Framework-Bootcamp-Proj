import { Injectable } from '@nestjs/common';
import { Hears, Help, On, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Injectable()
export class AppService {
  getData(): { message: string } {
    return { message: 'Welcome to server!' };
  }

  @Start()
  async startCommand(ctx: Context) {
    console.log("Message from user: ",ctx.message);
    console.log("Context: ",ctx);

    await ctx.reply('Welcome');
  }

  @Help()
  async helpCommand(ctx: Context) {
    console.log("Context: ",ctx);
    await ctx.reply('Send me a sticker');
  }

  @On('sticker')
  async onSticker(ctx: Context) {
    console.log("Context: ",ctx);
    await ctx.reply('👍');
  }

  @Hears('hi')
  async hearsHi(ctx: Context) {
    console.log("Context: ",ctx);
    await ctx.reply('Hey there');
  }
}
