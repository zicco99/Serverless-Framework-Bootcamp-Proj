export interface Auction {
    id: string;
    name: string;
    description: string;
    status: AuctionStatus;
    startDate: Date;
    endDate: Date;
    createdDate: string;
    updatedDate: string;
}

export enum AuctionStatus {
    OPEN = 'OPEN',
    IN_PROGRESS = 'IN_PROGRESS',
    CLOSED = 'CLOSED'
}