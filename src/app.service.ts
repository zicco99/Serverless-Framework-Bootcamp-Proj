import { Injectable } from '@nestjs/common';
import { Hears, Help, On, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
@Injectable()
export class AppService {
  getData(): { message: string } {
    return { message: 'Welcome to the party, pal!' };
  }

  @Start()
  async startCommand(ctx: Context) {
    console.log("Message from user: ", ctx.message);
    console.log("Context: ", ctx);
    
    await ctx.reply('Hello there! 🖖 Ready to have some fun? Type /help if you get lost!');
  }

  @Help()
  async helpCommand(ctx: Context) {
    console.log("Context: ", ctx);
    await ctx.reply('Need help? Just send me a sticker, a text, or type "lezzo" for a surprise! 😜');
  }

  @On('sticker')
  async onSticker(ctx: Context) {
    console.log("Context: ", ctx);
    await ctx.reply('Wow, nice sticker! Here’s a virtual high-five! ✋');
  }

  @Hears('lezzo')
  async hearsLezzo(ctx: Context) {
    console.log("Context: ", ctx);
    await ctx.reply('Maonna cara, muzunna! 😂');
  }

  @On('text')
  async onText(ctx: Context) {
    console.log("Context: ", ctx);
    
    const funnyReplies = [
      'That’s interesting! Tell me more... 🤔',
      'You’re on fire today! 🔥',
      'Haha, good one! 😂',
      'I totally agree! 👍',
      'You just made my day! 🌞'
    ];
    
    const randomReply = funnyReplies[Math.floor(Math.random() * funnyReplies.length)];
    await ctx.reply(randomReply);
  }

}
