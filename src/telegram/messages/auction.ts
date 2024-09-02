import { Auction, AuctionStatus } from 'src/auctions/models/auction.model';
import { escapeMarkdown } from './.utils';

export const formatAuctionMessage = (auction: Auction): string => {
  const statusIcon = auction.status === AuctionStatus.OPEN ? '🟢' :
                     auction.status === AuctionStatus.IN_PROGRESS ? '🟡' :
                     '🔴';

  const statusText = auction.status === AuctionStatus.OPEN ? 'Open for Bidding' :
                     auction.status === AuctionStatus.IN_PROGRESS ? 'Bidding in Progress' :
                     'Auction Closed';

  // Build the message without escaping
  const message = `*${statusIcon} Auction Name:* ${auction.name}\n` +
                  `*🆔 Auction ID:* \`${escapeMarkdown(auction.id)}\`\n` +
                  `*📝 Description:* ${escapeMarkdown(auction.description)}\n` +
                  `*🚦 Status:* ${escapeMarkdown(statusText)}\n` +
                  `*🗓️ Start Date:* ${escapeMarkdown(new Date(auction.startDate).toLocaleString())}\n` +
                  `*⏰ End Date:* ${escapeMarkdown(new Date(auction.endDate).toLocaleString())}\n` +
                  `*📅 Created On:* ${escapeMarkdown(new Date(auction.createdDate).toLocaleString())}\n` +
                  `*🔄 Last Updated:* ${escapeMarkdown(new Date(auction.updatedDate).toLocaleString())}\n`;

  // Escape the entire message
  return message;
};

export const auctionListMessage = (auctions: Auction[]): string => {
  return auctions.map(formatAuctionMessage).join('\n\n');
};
