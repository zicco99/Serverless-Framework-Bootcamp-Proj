import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Team } from './models/team.model';

@Injectable()
export class FootballApiService {
  private readonly apiUrl = 'https://api.football-data.org/v4/teams';
  private readonly apiKey = process.env.FOOTBALL_API_KEY;
  private readonly dynamoDbClient: DynamoDBClient;
  private readonly tableName = process.env.TEAMS_CACHE_TABLE_NAME;
  private readonly gsiName = process.env.TEAMS_CACHE_TABLE_INDEX_NAME;
  private readonly pageSize = 100;

  constructor(private readonly httpService: HttpService) {
    if (!this.apiKey) {
      throw new Error('The FOOTBALL_API_KEY environment variable is not set.');
    }
    this.dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
  }

  // Method to search teams by prefix
  async searchTeamsByPrefix(prefix: string): Promise<Team[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gsiName, 
        KeyConditionExpression: 'teamPrefix = :prefix and begins_with(teamName, :namePrefix)',
        ExpressionAttributeValues: marshall({
          ':prefix': prefix, 
          ':namePrefix': prefix,
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
  

  // Fetches teams, returns the first result set, and continues fetching in the background
  async getTeams(): Promise<Team[]> {
    let allTeams: Team[] = [];
    let offset = 0;

    try {
      // Fetch the first page of teams
      const initialResponse = await this.fetchTeams(offset);
      allTeams = initialResponse.teams;

      // Return the first page of results immediately
      if (allTeams.length === 0) {
        throw new NotFoundException('Seems like there are no teams in the database');
      }

      // Continue fetching in the background
      this.fetchRemainingTeams(offset + this.pageSize);

      return allTeams;
    } catch (error: any) {
      if (error.response) {
        throw new InternalServerErrorException(`API Error: ${error.response.statusText}`);
      } else {
        throw new InternalServerErrorException('An unexpected error occurred');
      }
    }
  }

  // Method to fetch a single page of teams
  private async fetchTeams(offset: number): Promise<{ teams: Team[] }> {
    const response = await firstValueFrom(
      this.httpService.get(this.apiUrl, {
        headers: {
          'X-Auth-Token': this.apiKey,
        },
        params: {
          limit: this.pageSize,
          offset: offset,
        },
      })
    );

    return response.data;
  }

  // Method to fetch remaining teams asynchronously
  private async fetchRemainingTeams(offset: number): Promise<void> {
    try {
      let moreTeamsExist = true;

      while (moreTeamsExist) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await this.fetchTeams(offset);
        const teams = response.teams;

        if (teams && teams.length > 0) {
          await this.saveToCache(teams);
          offset += this.pageSize;
        } else {
          moreTeamsExist = false;
        }
      }
    } catch (error) {
      console.error('Error fetching additional teams', error);
    }
  }

  // Save teams to the DynamoDB cache
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
