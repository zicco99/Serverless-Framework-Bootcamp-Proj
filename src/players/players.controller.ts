import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PlayersService } from './players.service';
import { Player, PlayerUniqueAttributes } from './models/player.model';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  // Route to get a single player by fullname and score
  @Get(':fullname/:score')
  async getPlayer(
    @Param('fullname') fullname: string,
    @Param('score', ParseIntPipe) score: number // Use ParseIntPipe to convert and validate score
  ): Promise<Player | undefined> {
    const uniqueAttributes : PlayerUniqueAttributes = { fullname, score };
    return this.playersService.getPlayer(uniqueAttributes);
  }

  // Route to get multiple players with optional pagination
  @Get()
  async getPlayers(
    @Query('fullname') fullname: string,
    @Query('score', ParseIntPipe) score: number,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('nextToken') nextToken?: string
  ): Promise<{ entities: Player[], nextToken?: string }> {
    const uniqueAttributes : PlayerUniqueAttributes = { fullname, score };
    return this.playersService.getPlayers(uniqueAttributes, limit, nextToken);
  }
}
