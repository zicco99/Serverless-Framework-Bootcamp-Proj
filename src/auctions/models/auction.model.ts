export interface Auction {
    id: string;
    name: string;
    description: string;
    status: AuctionStatus;
    startDate: Date;
    endDate: Date;
    createdDate: Date;
    updatedDate: Date;
}

export enum AuctionStatus {
    OPEN = 'OPEN',
    IN_PROGRESS = 'IN_PROGRESS',
    CLOSED = 'CLOSED'
}