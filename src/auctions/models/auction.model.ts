export interface Auction {
    id: string;
    idUser: string;
    name: string;
    description: string;
    status: AuctionStatus;
    startDate: string;
    endDate: string;
    createdDate: string;
    updatedDate: string;
}

export enum AuctionStatus {
    OPEN = 'OPEN',
    IN_PROGRESS = 'IN_PROGRESS',
    CLOSED = 'CLOSED'
}