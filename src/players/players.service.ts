import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand, ScanCommandOutput } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Player } from './models/player.model';
import { v4 as uuid } from 'uuid';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { UpdatePlayerDto } from './dtos/update-player.dto';

import { SportmonksService } from '../services/sport-monk.service';

@Injectable()
export class PlayersService {
  private readonly dynamoDbClient = new DynamoDBClient({ region: 'eu-west-1' });
  private readonly tableName = process.env.PLAYERS_TABLE_NAME;

  constructor(
    private readonly sportmonksService: SportmonksService,
  ) {
    if (!this.tableName) {
      throw new Error('The PLAYERS_TABLE_NAME environment variable is not set.');
    }
  }

  async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const player: Player = { id: uuid(), ...createPlayerDto };

    try {
      await this.dynamoDbClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall(player),
        }),
      );
      return player;
    } catch (error: any) {
      console.error('Error saving player to DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to save player data');
    }
  }

  async findOne(playerId: string): Promise<Player> {
    const playerFromDb = await this.getPlayerFromDynamoDB(playerId);

    if (playerFromDb) {
      return playerFromDb;
    }

    const playerFromApi = await this.sportmonksService.getPlayerById(playerId);
    if (playerFromApi) {
      await this.savePlayerToDynamoDB(playerFromApi);
      return playerFromApi;
    }

    throw new NotFoundException(`Player with ID ${playerId} not found`);
  }

  async update(playerId: string, playerData: UpdatePlayerDto): Promise<Player> {
    const updateExpressions = [];
    const expressionAttributeValues: { [key: string]: any } = {};

    for (const [key, value] of Object.entries(playerData)) {
      if (value) {
        updateExpressions.push(`${key} = :${key}`);
        if (typeof value === 'string') {
          expressionAttributeValues[`:${key}`] = { S: value };
        } else if (typeof value === 'number') {
          expressionAttributeValues[`:${key}`] = { N: value.toString() };
        }
      }
    }

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    try {
      await this.dynamoDbClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({ id: playerId }),
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );
      return { id: playerId, ...playerData } as Player;
    } catch (error: any) {
      console.error('Error updating player in DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to update player data');
    }
  }

  async delete(playerId: string): Promise<{ message: string }> {
    try {
      await this.dynamoDbClient.send(
        new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({ id: playerId }),
        }),
      );
      return { message: `Player with ID ${playerId} has been deleted` };
    } catch (error: any) {
      console.error('Error deleting player from DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to delete player data');
    }
  }

  async findAll(): Promise<Player[]> {
    try {
      const players: ScanCommandOutput = await this.dynamoDbClient.send(
        new ScanCommand({
          TableName: this.tableName,
        }),
      );
      return players.Items ? players.Items.map(item => unmarshall(item) as Player) : [];
    } catch (error: any) {
      console.error('Error fetching players from DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to retrieve player data from DynamoDB');
    }
  }

  async searchByName(name: string): Promise<Player[]> {
    const playersFromDb = await this.getPlayersByNameFromDynamoDB(name);

    if (playersFromDb.length > 0) {
      return playersFromDb;
    }

    const playersFromApi = await this.sportmonksService.searchPlayersByName(name);
    if (playersFromApi.length > 0) {
      await this.savePlayersToDynamoDB(playersFromApi);
      return playersFromApi;
    }

    return [];
  }

  //------------------------------------------------------

  private async getPlayerFromDynamoDB(playerId: string): Promise<Player | null> {
    try {
      const { Item } = await this.dynamoDbClient.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({ id: playerId }),
        }),
      );
      return Item ? unmarshall(Item) as Player : null;
    } catch (error: any) {
      console.error('Error fetching player from DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to retrieve player data from DynamoDB');
    }
  }

  private async getPlayersByNameFromDynamoDB(name: string): Promise<Player[]> {
    try {
      const players: ScanCommandOutput = await this.dynamoDbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'Name = :name',
          ExpressionAttributeValues: marshall({ ':name': name }),
        }),
      );
      return players.Items ? players.Items.map(item => unmarshall(item) as Player) : [];
    } catch (error: any) {
      console.error('Error fetching players from DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to retrieve player data from DynamoDB');
    }
  }

  private async savePlayerToDynamoDB(playerData: Player): Promise<void> {
    try {
      await this.dynamoDbClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall(playerData),
        }),
      );
    } catch (error: any) {
      console.error('Error saving player to DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to save player data to DynamoDB');
    }
  }

  private async savePlayersToDynamoDB(players: Player[]): Promise<void> {
    for (const player of players) {
      await this.savePlayerToDynamoDB(player);
    }
  }
}
