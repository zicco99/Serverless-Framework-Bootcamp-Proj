import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PlayersService } from './players.service';
import { Player } from './models/player.model';


@Controller('players')
export class PlayersController {
  constructor(private readonly players : PlayersService ) {}

  @Get()
  async getAll(){
    try {
      const players = await this.players.findAll();
      return players;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const player = await this.players.findOne(id);
      if (!player) {
        throw new HttpException('No player found', HttpStatus.NOT_FOUND);
      }
      return player;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post()
  async insert(@Body() createPlayerDto: { name: string; position: string; club: string }) {
    const { name, position, club } = createPlayerDto;
    if (!name || !position || !club) {
      throw new HttpException('Fields name, position, and club are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const player = await this.players.create({ name, position, club });
      return player;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePlayerDto: { name?: string; position?: string; club?: string },
  ) {
    const args: Partial<Player> = {};
    if (updatePlayerDto.name) args.name = updatePlayerDto.name;
    if (updatePlayerDto.position) args.position = updatePlayerDto.position;
    if (updatePlayerDto.club) args.club = updatePlayerDto.club;

    try {
      const player = await this.players.update(id, args);
      return player;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.players.delete
      return { statusCode: HttpStatus.OK, message: 'Player deleted successfully' };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }
}
