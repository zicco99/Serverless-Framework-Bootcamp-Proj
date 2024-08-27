import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { FootbalApiService } from '../services/football-api/football-api.service'; // Adjust the import path as necessary
import { Team } from '../services/football-api/models/team.model'; // Adjust the import path as necessary

@Injectable()
export class TeamsService {
  constructor(private readonly footballApiService: FootbalApiService) {}

  async getTeams(): Promise<Team[]> {
    try {
      return await this.footballApiService.getTeams();
    } catch (error) {
      throw new InternalServerErrorException('Failed to get teams');
    }
  }

  async searchTeamsByPrefix(prefix: string): Promise<Team[]> {
    try {
      return await this.footballApiService.searchTeamsByPrefix(prefix);
    } catch (error) {
      throw new InternalServerErrorException('Failed to search teams');
    }
  }
}
