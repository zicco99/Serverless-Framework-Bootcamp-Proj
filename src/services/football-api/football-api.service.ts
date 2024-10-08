import {
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DynamoDBClient,
  QueryCommand,
  BatchWriteItemCommand,
  BatchWriteItemCommandOutput,
  AttributeValue,
  WriteRequest,
  QueryCommandOutput
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Team } from './models/team.model';
import { omit } from 'lodash'; 

@Injectable()
export class FootballApiService {
  private readonly apiUrl = 'https://api.football-data.org/v4/teams';
  private readonly apiKey = process.env.FOOTBALL_API_KEY;
  private readonly dynamoDbClient: DynamoDBClient;
  private readonly tableName = process.env.TEAMS_CACHE_TABLE_NAME as string;
  private readonly gsiName = process.env.TEAMS_CACHE_TABLE_INDEX_NAME as string;
  private readonly pageSize = 100;

  constructor(private readonly httpService: HttpService) {
    if (!this.apiKey) {
      throw new Error('The FOOTBALL_API_KEY environment variable is not set.');
    }
    this.dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
  }

  // Generate distinct prefixes for a given team name
  private generateDistinctPrefixes(name: string, maxLength: number = 5): string[] {
    const prefixes: Set<string> = new Set();
    const upperCaseName = name.toUpperCase();
    const nameLength = upperCaseName.length;

    for (let i = 1; i <= Math.min(maxLength, nameLength); i++) {
      prefixes.add(upperCaseName.substring(0, i));
    }

    return Array.from(prefixes);
  }

  // Retrieve existing prefixes from DynamoDB
  private async getExistingPrefixes(): Promise<Set<string>> {
    try {
      const existingPrefixes: Set<string> = new Set();
      let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

      do {
        const command = new QueryCommand({
          TableName: this.tableName,
          IndexName: this.gsiName,
          KeyConditionExpression: 'teamPrefix = :prefix',
          ExpressionAttributeValues: {
            ':prefix': { S: 'EXISTING_PREFIX' } // Placeholder value
          },
          ProjectionExpression: 'teamPrefix',
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const { Items, LastEvaluatedKey } = await this.dynamoDbClient.send(command);
        lastEvaluatedKey = LastEvaluatedKey;

        if (Items) {
          for (const item of Items) {
            const unmarshalledItem = unmarshall(item) as { teamPrefix: string };
            existingPrefixes.add(unmarshalledItem.teamPrefix);
          }
        }
      } while (lastEvaluatedKey);

      return existingPrefixes;
    } catch (error) {
      console.error('Error retrieving existing prefixes', error);
      throw new InternalServerErrorException('Error retrieving existing prefixes');
    }
  }

  // Get new prefixes that are not already in use
  private async getNewPrefixes(name: string, maxLength: number = 5): Promise<string[]> {
    const allPrefixes = this.generateDistinctPrefixes(name, maxLength);
    const existingPrefixes = await this.getExistingPrefixes();

    return allPrefixes.filter(prefix => !existingPrefixes.has(prefix));
  }

  // Method to search teams by prefix
  async searchTeamsByPrefix(prefix: string): Promise<Team[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gsiName,
        KeyConditionExpression: 'teamPrefix = :prefix AND begins_with(teamName, :namePrefix)',
        ExpressionAttributeValues: {
          ':prefix': { S: prefix },
          ':namePrefix': { S: prefix }
        }
      });

      const { Items }: QueryCommandOutput = await this.dynamoDbClient.send(command);

      if (Items) {
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
      const initialResponse = await this.fetchTeams(offset);
      allTeams = initialResponse.teams;

      if (allTeams.length === 0) {
        throw new NotFoundException('No teams found in the API response');
      }

      await this.saveToCache(allTeams);
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
    try {
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
    } catch (error) {
      console.error('Error fetching teams from API', error);
      throw new InternalServerErrorException('Error fetching teams from API');
    }
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
      const requests: WriteRequest[] = [];

      for (const team of teams) {
        const prefixes = await this.getNewPrefixes(team.name, 5);

        for (const prefix of prefixes) {
          requests.push({
            PutRequest: {
              Item: marshall({
                id: `${prefix}#${team.id}`,
                teamPrefix: prefix,
                teamName: team.name,
                ...omit(team, ['id', 'name']),
              }) as Record<string, AttributeValue>,
            },
          });
        }
      }

      // Batch write items to DynamoDB
      while (requests.length > 0) {
        const batch = requests.splice(0, 25);

        const command = new BatchWriteItemCommand({
          RequestItems: {
            [this.tableName]: batch,
          },
        });

        // Execute the batch write command
        const response: BatchWriteItemCommandOutput = await this.dynamoDbClient.send(command);

        // Retry any unprocessed items
        const unprocessedItems = response.UnprocessedItems?.[this.tableName] || [];
        if (unprocessedItems.length > 0) {
          console.warn(`Retrying ${unprocessedItems.length} unprocessed items...`);
          // Convert unprocessed items back to WriteRequest format
          requests.unshift(
            ...unprocessedItems.map(item => ({
              PutRequest: {
                Item: item.PutRequest?.Item as Record<string, AttributeValue>,
              },
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error saving to cache', error);
      throw new InternalServerErrorException('Error saving to cache');
    }
  }
}
