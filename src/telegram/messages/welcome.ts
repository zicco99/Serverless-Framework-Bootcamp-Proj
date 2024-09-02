import { escapeMarkdown } from './.utils';

export const welcomeMessage = (userName: string, auctionsCounts: number): string => {
    const currentTime = new Date().toLocaleString();

    let message = `*Hi, ${escapeMarkdown(userName)}\\!*\n\n` +
                  `Here are some quick stats for you:\n` +
                  `\\- *Current Time:* ${escapeMarkdown(currentTime)} 🕖\n` +
                  `\\- *Auctions Available:* ${escapeMarkdown(auctionsCounts.toString())} 🔥\n\n` +
                  `*﹎﹎﹎﹎﹎﹎﹎*\n\n` +
                  `Welcome to the ultimate auctions manager bot\\! 🎉\n` +
                  `Get started by using /help and /userguide 📘\\.\n\n` +
                  `*﹎﹎﹎﹎﹎﹎﹎*\n\n` +
                  `Wishing you peace and love ❤️\n` +
                  `*Zik*`;

    return message;
};
