import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, SelectObjectContentCommand } from '@aws-sdk/client-s3';
import { BloomFilterManagerService } from '../lib/bloom-filter-manager.service';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { Player, PlayerUniqueAttributes } from './models/player.model';
import { S3HashRing } from '../lib/s3-hash-ring.util';

@Injectable()
export class PlayersService {
  private readonly s3HashRing: S3HashRing<Player, CreatePlayerDto, PlayerUniqueAttributes>;

  constructor(
    private readonly bloomFilterManager: BloomFilterManagerService
  ) {
    this.s3HashRing = new S3HashRing<Player, CreatePlayerDto, PlayerUniqueAttributes>(
      ['fullname', 'score'],
      (createPlayerDto: CreatePlayerDto, id: string): Player => ({
        id,
        ...createPlayerDto,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      }),
      (entity: Player): PlayerUniqueAttributes => ({
        fullname: entity.fullname,
        score: entity.score
      }),
      bloomFilterManager
    );
  }

  async putPlayer(createPlayerDto: CreatePlayerDto): Promise<void> {
    const playerId = this.s3HashRing.createHash(createPlayerDto);
  
    try {
      // Add the player entity to the S3 bucket using the S3 hash ring utility
      await this.s3HashRing.addEntity(createPlayerDto);
    } catch (err: any) {
      console.error(`Failed to put player data: ${err.message}`);
      throw new Error(`Failed to put player with ID ${playerId}: ${err.message}`);
    }
  }

  async getPlayer(uniqueAttributes: PlayerUniqueAttributes): Promise<Player | undefined> {
    const playerId = this.s3HashRing.createHash(uniqueAttributes);
    const bucket = this.s3HashRing.getBucket(uniqueAttributes);

    if (!bucket) {
      throw new Error(`Bucket for player ${playerId} not found`);
    }
  
    const bloomFilter = this.bloomFilterManager.getCache().get(bucket);

    if (!bloomFilter?.has(playerId)) {
      console.log(`Player ID ${playerId} not found in Bloom filter.`);
      throw new NotFoundException('Player ID not found in Bloom filter');
    }

    // Use the S3HashRing to find the player
    const player = await this.s3HashRing.findOne(uniqueAttributes);
    if (!player) {
      console.log(`Player ID ${playerId} not found in data store.`);
      throw new NotFoundException('Player not found in data store');
    }

    return player;
  }

  async getPlayers(
    uniqueAttributes: PlayerUniqueAttributes,
    limit: number = 10,
    nextToken?: string
  ): Promise<{ entities: Player[], nextToken?: string }> {
    try {
      const result = await this.s3HashRing.findWithContinuationToken(uniqueAttributes, limit, nextToken);

      const { entities, nextToken: nextContToken } = result;

      return { entities, nextToken: nextContToken };
    } catch (err: any) {
      console.error(`Failed to get players data: ${err.message}`);
      throw new Error(`Failed to get players: ${err.message}`);
    }
  }
}
