import { Controller, Get, Post, Body, Param, Delete, Put, Query, Patch } from '@nestjs/common';
import { Player } from 'src/players/models/player.model';
import { PlayersService } from './players.service';

@Controller('players')
export class PlayersController{
  constructor(private readonly players: PlayersService) {}

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Player> {
    const player = await this.players.getPlayer(id);

    if (!player) {
      throw new Error('Player not found');
    }

    return player;
  }


}
