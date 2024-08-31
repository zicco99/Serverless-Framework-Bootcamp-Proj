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
                  `*🆔 Auction ID:* \`${auction.id}\`\n` +
                  `*📝 Description:* ${auction.description}\n` +
                  `*🚦 Status:* ${statusText}\n` +
                  `*🗓️ Start Date:* ${new Date(auction.startDate).toLocaleString()}\n` +
                  `*⏰ End Date:* ${new Date(auction.endDate).toLocaleString()}\n` +
                  `*📅 Created On:* ${new Date(auction.createdDate).toLocaleString()}\n` +
                  `*🔄 Last Updated:* ${new Date(auction.updatedDate).toLocaleString()}`;

  // Escape the entire message
  return escapeMarkdown(message);
};
