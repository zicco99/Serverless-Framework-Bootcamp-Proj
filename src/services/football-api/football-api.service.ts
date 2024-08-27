import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Team } from './models/team.model'; // Ensure the Team model is properly defined

@Injectable()
export class FootbalApiService {
  private readonly apiUrl = 'https://api.football-data.org/v4/teams';
  private readonly apiKey = process.env.FOOTBALL_API_KEY;
  private readonly dynamoDbClient: DynamoDBClient;
  private readonly tableName = 'TeamsCache';
  private readonly gsiName = 'TeamNameIndex'; 

  constructor(private readonly httpService: HttpService) {
    if (!this.apiKey) {
      throw new Error('The FOOTBALL_API_KEY environment variable is not set.');
    }
    this.dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
  }

  // Method to get teams by prefix search
  async searchTeamsByPrefix(prefix: string): Promise<Team[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gsiName,
        KeyConditionExpression: 'teamName = :prefix',
        ExpressionAttributeValues: marshall({
          ':prefix': prefix + '\u{FFFF}', 
        }),
        ProjectionExpression: 'teamId, teamName, otherAttributes',
      });

      const { Items } = await this.dynamoDbClient.send(command);
      if (Items && Items.length > 0) {
        return Items.map(item => unmarshall(item) as Team);
      }
      return [];
    } catch (error) {
      console.error('Error fetching from cache', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async getTeams(): Promise<Team[]> {
    try {
      const response = await firstValueFrom(this.httpService.get(this.apiUrl, {
        headers: {
          'X-Auth-Token': this.apiKey,
        },
      }));

      const teams = response.data.teams;
      if (!teams || teams.length === 0) {
        throw new NotFoundException('No teams found');
      }

      await this.saveToCache(teams);

      return teams;
    } catch (error: any ) {
      if (error.response) {
        throw new InternalServerErrorException(`API Error: ${error.response.statusText}`);
      } else {
        throw new InternalServerErrorException('An unexpected error occurred');
      }
    }
  }

  private async saveToCache(teams: Team[]): Promise<void> {
    try {
      for (const team of teams) {
        await this.dynamoDbClient.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: marshall({
              teamId: team.id,
              teamName: team.name,
              ...team,
            }),
          }),
        );
      }
    } catch (error) {
      console.error('Error saving to cache', error);
    }
  }
}
