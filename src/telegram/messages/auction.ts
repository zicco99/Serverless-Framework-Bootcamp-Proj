import { Auction, AuctionStatus } from 'src/auctions/models/auction.model';
import { escapeMarkdown } from './.utils';

export const formatAuctionMessage = (auction: Auction): string => {
    const statusIcon = auction.status === AuctionStatus.OPEN ? '🟢' :
                       auction.status === AuctionStatus.IN_PROGRESS ? '🟡' :
                       '🔴';
  
    const statusText = auction.status === AuctionStatus.OPEN ? 'Open for Bidding' :
                       auction.status === AuctionStatus.IN_PROGRESS ? 'Bidding in Progress' :
                       'Auction Closed';
  
    return `*${statusIcon} Auction Name:* ${escapeMarkdown(auction.name)}\n` +
           `*🆔 Auction ID:* \`${escapeMarkdown(auction.id)}\`\n` +
           `*📝 Description:* ${escapeMarkdown(auction.description)}\n` +
           `*🚦 Status:* ${statusText}\n` +
           `*🗓️ Start Date:* ${escapeMarkdown(new Date(auction.startDate).toLocaleString().replace(/\./g, '\\.'))}\n` +
           `*⏰ End Date:* ${escapeMarkdown(new Date(auction.endDate).toLocaleString().replace(/\./g, '\\.'))}\n` +
           `*📅 Created On:* ${escapeMarkdown(new Date(auction.createdDate).toLocaleString().replace(/\./g, '\\.'))}\n` +
           `*🔄 Last Updated:* ${escapeMarkdown(new Date(auction.updatedDate).toLocaleString().replace(/\./g, '\\.'))}`;
  };

export const listAuctionsMessage = (auctions: Auction[]): string => {
    if (auctions.length === 0) {
      return '🚫 *No open auctions available at the moment. Please check back later!*';
    }
  
    const auctionList = auctions.map(auction => formatAuctionMessage(auction)).join('\n\n');
  
    return `*🔍 Current Auctions:*\n\n${escapeMarkdown(auctionList)}`;
  };