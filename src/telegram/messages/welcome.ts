import { escapeMarkdown } from './.utils';

export const welcomeMessage = (userName: string, auctionsCounts: number): string => {
  let message = `*Hi, ${userName}*

Here are some quick stats for you:
- *Current Time:* ${new Date().toLocaleString()} 🕖
- *Auctions Available:* ${auctionsCounts.toString()} 🔥

*﹎﹎﹎﹎﹎﹎﹎*

Welcome to the ultimate auctions manager bot.
Get started by using /help and /userguide 📘.

*﹎﹎﹎﹎﹎﹎﹎*

Wishing you peace and love ✌️❤️,
*Zik*`;

  return escapeMarkdown(message);
};
