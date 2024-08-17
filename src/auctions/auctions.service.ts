import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Auction, AuctionStatus } from 'src/auctions/models/auction.model';
import { CreateAuctionDto } from './dtos/create-auction.dto';
import { DeleteAuctionDto } from './dtos/delete-auction.dto';
import { UpdateAuctionDto } from './dtos/update-auction.dto';

@Injectable()
export class AuctionsService {
  private readonly client = new DynamoDBClient({ region: 'eu-west-1' });
  private readonly tableName = process.env.AUCTIONS_TABLE_NAME;

  async findAll(): Promise<Auction[]> {
    // Query to get all auctions with status 'OPEN'
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'statusAndEndDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'OPEN',
      }),
    });

    try {
      const result = await this.client.send(command);
      return result.Items ? result.Items.map(item => unmarshall(item) as Auction) : [];
    } catch (error) {
      console.error('Error querying auctions:', error);
      throw new Error('Failed to retrieve auctions');
    }
  }

  async findOne(id: string): Promise<Auction> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ id }),
    });

    const result = await this.client.send(command);
    if (!result.Item) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }
    return unmarshall(result.Item) as Auction;
  }

  async createAuction(createAuctionDto: CreateAuctionDto): Promise<Auction> {
    const { name, description, startDate, endDate } = createAuctionDto;

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const newAuction: Auction = {
      id: uuid(),
      name,
      description,
      status: AuctionStatus.OPEN,
      startDate,
      endDate,
      createdDate: new Date(),
      updatedDate: new Date(),
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(newAuction),
    });

    await this.client.send(command);
    return newAuction;
  }

  async deleteAuction(deleteAuctionDto: DeleteAuctionDto): Promise<Auction> {
    const { id } = deleteAuctionDto;

    const existingAuction = await this.findOne(id); // Ensure it exists before deleting

    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ id }),
    });

    await this.client.send(command);
    return existingAuction;
  }

  async updateAuction(id: string, updateAuctionDto: Partial<UpdateAuctionDto>): Promise<Auction> {
    const existingAuction = await this.findOne(id);

    const updatedAuction: Auction = {
      ...existingAuction,
      ...updateAuctionDto,
      updatedDate: new Date(),
    };

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ id }),
      UpdateExpression: 'set #name = :name, #description = :description, #status = :status, #startDate = :startDate, #endDate = :endDate, #updatedDate = :updatedDate',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#description': 'description',
        '#status': 'status',
        '#startDate': 'startDate',
        '#endDate': 'endDate',
        '#updatedDate': 'updatedDate',
      },
      ExpressionAttributeValues: marshall({
        ':name': updatedAuction.name,
        ':description': updatedAuction.description,
        ':status': updatedAuction.status,
        ':startDate': updatedAuction.startDate,
        ':endDate': updatedAuction.endDate,
        ':updatedDate': updatedAuction.updatedDate,
      }),
      ReturnValues: 'ALL_NEW',
    });

    const result = await this.client.send(command);
    return unmarshall(result.Attributes as Record<string, any>) as Auction;
  }
}
