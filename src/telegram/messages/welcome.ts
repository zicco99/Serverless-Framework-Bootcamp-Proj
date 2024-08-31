import { escapeMarkdown } from './.utils';

export const welcomeMessage = (userName: string, auctionsCounts: number): string => {
  // Construct the message with proper MarkdownV2 escaping
  let message = `*Hi, ${escapeMarkdown(userName)}*

Here are some quick stats for you:
\\- *Current Time:* ${escapeMarkdown(new Date().toLocaleString())} 🕖
\\- *Auctions Available:* ${escapeMarkdown(auctionsCounts.toString())} 🔥

*﹎﹎﹎﹎﹎﹎﹎*

Welcome to the ultimate auctions manager bot.
Get started by using /help and /userguide 📘.

*﹎﹎﹎﹎﹎﹎﹎*

Wishing you peace and love ✌️❤️,
*Zik*`;

  // Escape the entire message
  return escapeMarkdown(message);
};
