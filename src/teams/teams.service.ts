import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { FootballApiService } from '../services/football-api/football-api.service'; // Adjust the import path as necessary
import { Team } from '../services/football-api/models/team.model'; // Adjust the import path as necessary

@Injectable()
export class TeamsService {
  constructor(private readonly footballApiService: FootballApiService) {}

  async getTeams(): Promise<Team[]> {
    return await this.footballApiService.getTeams();
  }

  async searchTeamsByPrefix(prefix: string): Promise<Team[]> {
    return await this.footballApiService.searchTeamsByPrefix(prefix);
  }
}
