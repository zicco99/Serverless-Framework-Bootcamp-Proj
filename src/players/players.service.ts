import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand, ScanCommandOutput } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Player } from './models/player.model';

@Injectable()
export class PlayersService {
  private readonly apiUrl = 'https://v3.football.api-sports.io';
  private readonly apiKey = process.env.FOOTBALL_API_KEY;
  
  private readonly dynamoDbClient = new DynamoDBClient({ region: 'eu-west-1' });
  private readonly tableName = process.env.PLAYERS_TABLE_NAME;

  constructor(private readonly httpService: HttpService) {
    if (!this.apiKey) {
      throw new Error('The FOOTBALL_API_KEY environment variable is not set.');
    }
    if (!this.tableName) {
      throw new Error('The PLAYERS_TABLE_NAME environment variable is not set.');
    }
  }

  // CREATE: Insert a new player into DynamoDB
  async create(playerData: Partial<Player>): Promise<Player> {
    this.validatePlayerData(playerData);

    const playerId = playerData.id || new Date().getTime().toString();
    const item = { id: playerId, ...playerData };

    try {
      await this.dynamoDbClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall(item),
        }),
      );
      return item as Player;
    } catch (error: any) {
      console.error('Error saving player to DynamoDB:', error.message);
      throw new InternalServerErrorException('Failed to save player data');
    }
  }

  // READ: Get a player by ID
  async findOne(playerId: string): Promise<Player> {
    const playerFromDb = await this.getPlayerFromDynamoDB(playerId);

    if (playerFromDb) {
      return playerFromDb;
    }

    const playerFromApi = await this.getPlayerFromAPI(playerId);
    if (playerFromApi) {
      await this.savePlayerToDynamoDB(playerFromApi);
      return playerFromApi;
    }

    throw new NotFoundException(`Player with ID ${playerId} not found`);
  }

  // UPDATE: Update a player's details
  async update(playerId: string, playerData: Partial<Player>): Promise<Player> {
    this.validateUpdateData(playerData);

    const updateExpressions = [];
    const expressionAttributeValues: { [key: string]: any } = {};

    if (playerData.name) {
      updateExpressions.push('name = :name');
      expressionAttributeValues[':name'] = { S: playerData.name };
    }

    if (playerData.position) {
      updateExpressions.push('position = :position');
      expressionAttributeValues[':position'] = { S: playerData.position };
    }

    if (playerData.club) {
      updateExpressions.push('club = :club');
      expressionAttributeValues[':club'] = { S: playerData.club };
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

  // DELETE: Remove a player from DynamoDB
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

  // READ ALL: Get all players from DynamoDB
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

  private async getPlayerFromAPI(playerId: string): Promise<Player | null> {
    const url = `${this.apiUrl}/players?id=${playerId}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { 'x-apisports-key': this.apiKey },
        }),
      );
      const playerData = response.data.response;

      if (!playerData || playerData.length === 0) {
        throw new NotFoundException('Player not found in the API');
      }

      return playerData[0] as Player;
    } catch (error: any) {
      console.error('Error fetching player from API:', error.message);
      throw new InternalServerErrorException('Failed to fetch player data from API');
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

  // Validation methods
  private validatePlayerData(playerData: Partial<Player>): void {
    if (!playerData.name || !playerData.position || !playerData.club) {
      throw new BadRequestException('Fields name, position, and club are required');
    }
  }

  private validateUpdateData(playerData: Partial<Player>): void {
    if (!playerData.name && !playerData.position && !playerData.club) {
      throw new BadRequestException('No fields provided to update');
    }
  }
}
