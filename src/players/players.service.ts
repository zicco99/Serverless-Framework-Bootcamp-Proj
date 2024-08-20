import { Injectable } from '@nestjs/common';
import { S3HashRing } from 'src/lib/s3-hash-ring.util';
import { Player } from './models/player.model';
import { CreatePlayerDto } from './dtos/create-player.dto';

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
    return { id: entity.id };
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
