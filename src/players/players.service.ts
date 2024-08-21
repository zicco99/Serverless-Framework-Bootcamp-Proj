import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import streamToString from 'stream-to-string';
import { Readable } from 'stream';
import { S3HashRing } from '../lib/s3-hash-ring.util';
import { PlayerUniqueAttributes } from './players.controller';
import { Player } from './models/player.model';
import { BloomFilterManagerService } from '../lib/bloom-filter.service';
import { CreatePlayerDto } from './dtos/create-player.dto';
import crypto from 'crypto';
import { serializeAndUploadBloomFilter, downloadAndDeserializeBloomFilter } from '../lib/s3-bloom.util';
import { Injectable } from '@nestjs/common';
import { BloomFilter } from 'bloom-filters';

@Injectable()
export class PlayersService {
  private readonly s3Client: S3Client;
  private readonly s3HashRing: S3HashRing<Player, CreatePlayerDto, PlayerUniqueAttributes>;
  private readonly bloomFilterManager: BloomFilterManagerService;
  private bloomFilter: BloomFilter;

  constructor(s3Client: S3Client, bloomFilterManager: BloomFilterManagerService) {
    this.s3Client = s3Client;
    this.bloomFilterManager = bloomFilterManager;

    // Create the S3 hash ring
    this.s3HashRing = new S3HashRing<Player, CreatePlayerDto, PlayerUniqueAttributes>(
      ['fullname', 'score'],
      (createPlayerDto: CreatePlayerDto): Player => {
        const id = this.createPlayerId({
          fullname: createPlayerDto.fullname,
          score: createPlayerDto.score
        });
        return {
          id,
          ...createPlayerDto,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        };
      },
      (entity: Player): PlayerUniqueAttributes => ({
        fullname: entity.fullname,
        score: entity.score
      }),
      bloomFilterManager
    );
  }

  /**
   * Ensures the Bloom filter is initialized.
   */
  private async ensureBloomFilterInitialized(bucket: string): Promise<void> {
    if (!this.bloomFilter) {
      this.bloomFilter = await this.bloomFilterManager.getBloomFilter(bucket);
    }
  }

  /**
   * Adds or updates a player in S3 and updates the Bloom filter.
   * @param createPlayerDto - The data to create or update the player.
   */
  async putPlayer(createPlayerDto: CreatePlayerDto): Promise<void> {
    const bucket = this.s3HashRing.getBucket(createPlayerDto);
    
    await this.ensureBloomFilterInitialized(bucket);

    const player = this.s3HashRing.dtoToEntityMapper(createPlayerDto, this.createPlayerId(createPlayerDto));
    
    // Add player ID to the Bloom filter
    this.bloomFilter.add(player.id);

    // Fetch current data from S3
    let existingPlayers: Player[] = [];
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: this.getPlayerDataKey(bucket),
      }));
      const data = await streamToString(response.Body as Readable);
      existingPlayers = JSON.parse(data) as Player[];
    } catch (err: any) {
      if (err.name === 'NoSuchKey') {
        existingPlayers = [];
      } else {
        console.error(`Error fetching player data from bucket ${bucket}:`, err);
        throw new Error('Failed to fetch player data');
      }
    }

    // Update or add the player to the list
    const playerIndex = existingPlayers.findIndex(p => p.id === player.id);
    if (playerIndex > -1) {
      existingPlayers[playerIndex] = player;
    } else {
      existingPlayers.push(player);
    }

    // Upload updated data to S3
    await this.s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: this.getPlayerDataKey(bucket),
      Body: JSON.stringify(existingPlayers),
      ContentType: 'application/json',
    }));

    // Save updated Bloom filter to S3
    await serializeAndUploadBloomFilter(bucket, 'bloom-filter.json', this.bloomFilter);
  }

  /**
   * Retrieves a player by unique attributes.
   * @param playerUniqueAttributes - The unique attributes of the player.
   * @returns The player data if found, or undefined if not found.
   */
  async getPlayer(playerUniqueAttributes: PlayerUniqueAttributes): Promise<Player | undefined> {
    const playerId = this.createPlayerId(playerUniqueAttributes);
    const bucket = this.s3HashRing.getBucket(playerUniqueAttributes);

    await this.ensureBloomFilterInitialized(bucket);

    // Check if the player ID is in the Bloom filter
    if (!this.bloomFilter.has(playerId)) {
      console.log(`Player ID ${playerId} not found in Bloom filter.`);
      return undefined;
    }

    // Fetch the player data from S3
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: this.getPlayerKey(bucket, playerId),
      }));
      const data = await streamToString(response.Body as Readable);
      return JSON.parse(data) as Player;
    } catch (err: any) {
      if (err.name === 'NoSuchKey') {
        console.log(`Player ID ${playerId} not found in S3.`);
        return undefined;
      }
      console.error(`Error retrieving player data from bucket ${bucket}:`, err);
      throw new Error('Failed to retrieve player data');
    }
  }

  /**
   * Retrieves multiple players based on unique attributes, with optional pagination.
   * @param uniqueAttributes - The unique attributes of the players.
   * @param limit - The maximum number of players to retrieve.
   * @param nextToken - The token for pagination.
   * @returns The list of players and the nextToken for pagination.
   */
  async getPlayers(uniqueAttributes: PlayerUniqueAttributes, limit: number = 10, nextToken?: string): Promise<{ entities: Player[], nextToken?: string }> {
    const bucket = this.s3HashRing.getBucket(uniqueAttributes);

    // Build S3 Select query for pagination
    let query = `SELECT * FROM s3object WHERE fullname = '${uniqueAttributes.fullname}' AND score = ${uniqueAttributes.score}`;
    if (nextToken) {
      query += ` AND id > '${nextToken}'`;
    }

    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: this.getPlayerDataKey(bucket),
      }));
      const data = await streamToString(response.Body as Readable);
      const players = JSON.parse(data) as Player[];

      // Process the data and handle pagination
      const entities = players.slice(0, limit);
      const newNextToken = players.length > limit ? entities[entities.length - 1].id : undefined;

      return { entities, nextToken: newNextToken };
    } catch (err) {
      console.error(`Error retrieving players from bucket ${bucket}:`, err);
      throw new Error('Failed to retrieve players');
    }
  }

  /**
   * Generates the S3 key for storing player data.
   * @param bucket - The name of the S3 bucket.
   * @param playerId - The ID of the player.
   * @returns The S3 key for the player data.
   */
  private getPlayerKey(bucket: string, playerId: string): string {
    return `${bucket}/players/${playerId}.json`;
  }

  /**
   * Generates the S3 key for storing all player data.
   * @param bucket - The name of the S3 bucket.
   * @returns The S3 key for all player data.
   */
  private getPlayerDataKey(bucket: string): string {
    return `${bucket}/players_data.json`;
  }

  /**
   * Creates a unique identifier for the player based on their unique attributes.
   * @param uniqueAttributes - The unique attributes of the player.
   * @returns The unique identifier for the player.
   */
  private createPlayerId(uniqueAttributes: PlayerUniqueAttributes): string {
    const values = Object.values(uniqueAttributes).map(value => String(value)).join(',');
    return crypto.createHash('sha256').update(values).digest('hex');
  }
}
