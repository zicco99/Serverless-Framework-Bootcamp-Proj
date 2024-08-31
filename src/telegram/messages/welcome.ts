export const welcomeMessage = (userName : string, auctionsCounts: number) => `
*Hi, ${userName}! :) (zik blesses you 🙏🏼)*

Here are some quick stats for you:
- *Current Time:* ${new Date().toLocaleString()} 🕖
- *Auctions Available:* ${auctionsCounts} 🔥

*﹎﹎﹎﹎﹎﹎﹎*

Welcome to the ultimate auctions manager bot.
Get started by using /help and /userguide 📘.

*﹎﹎﹎﹎﹎﹎﹎*

Wishing you peace and love ✌️❤️,
*Zik ®*
`;