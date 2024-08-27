import { Controller, Get, Query, Param, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { TeamsService } from './teams.service'; 
import { Team } from '../services/football-api/models/team.model';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async getAllTeams(): Promise<Team[]> {
    try {
      return await this.teamsService.getTeams();
    } catch (error) {
      throw new InternalServerErrorException('Failed to get teams');
    }
  }

  @Get('search')
  async searchTeams(@Query('prefix') prefix: string): Promise<Team[]> {
    if (!prefix) {
      throw new BadRequestException('Prefix query parameter is required');
    }

    try {
      const teams = await this.teamsService.searchTeamsByPrefix(prefix);
      if (teams.length === 0) {
        throw new NotFoundException('No teams found matching the given prefix');
      }
      return teams;
    } catch (error) {
      throw new InternalServerErrorException('Failed to search teams');
    }
  }
}