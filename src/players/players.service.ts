import { Injectable } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3HashRing } from 'src/lib/s3-hash-ring.util'; // Ensure correct path and import
import { Player } from './models/player.model';
import { CreatePlayerDto } from './dtos/create-player.dto';

// Define a generic DTO type with attributes used for hashing
export type EntityDto = {
  id: string;
  [key: string]: any;
};

// Define UniqueAttributes based on your use case
type PlayerUniqueAttributes = {
  id: string;
};

@Injectable()
export class PlayersService {

  private readonly hashRing: S3HashRing<Player, CreatePlayerDto, PlayerUniqueAttributes>;

  constructor() {
    this.hashRing = new S3HashRing<Player, CreatePlayerDto, PlayerUniqueAttributes>(
      ['id'],
      this.dtoToEntityMapper,
      this.entityToUniqueAttributes
    );
  }

  private dtoToEntityMapper(dto: CreatePlayerDto): Player {
    return dto as unknown as Player;
  }

  private entityToUniqueAttributes(entity: Player): PlayerUniqueAttributes {
    return { id: entity.id }; // Simplified extraction
  }

  async addPlayer(dto: CreatePlayerDto): Promise<void> {
    await this.hashRing.addEntity(dto);
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    return await this.hashRing.getEntity({ id });
  }

  async getPlayers(id: string): Promise<Player[]> {
    return await this.hashRing.getEntities({ id });
  }
}
