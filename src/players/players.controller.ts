import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PlayersService } from './players.service';
import { Player } from './models/player.model';
import { CreatePlayerDto } from './dtos/create-player.dto';
import { UpdatePlayerDto } from './dtos/update-player.dto'

@Controller('players')
export class PlayersController {
  constructor(private readonly players : PlayersService ) {}

  // Basic CRUD

  @Get()
  async getAll(){
    try {
      const players : Player[] = await this.players.findAll();
      return players;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const player : Player = await this.players.findOne(id);
      if (!player) {
        throw new HttpException('No player found', HttpStatus.NOT_FOUND);
      }
      return player;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post()
  async insert(@Body() createPlayerDto: CreatePlayerDto) {
    try {
      const player : Player = await this.players.create(createPlayerDto);
      return player;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePlayerDto: UpdatePlayerDto,
  ) {
    try {
      const player = await this.players.update(id, updatePlayerDto);
      return player;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.players.delete(id);
      return { statusCode: HttpStatus.OK, message: 'Player deleted successfully' };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  //Utility methods

  @Get('search')
  async search(@Query('name') name: string) {
    try {
      const players = await this.players.search(name);
      return players;
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }
}
