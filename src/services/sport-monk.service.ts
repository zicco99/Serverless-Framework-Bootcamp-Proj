import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Player } from '../players/models/player.model';

@Injectable()
export class SportmonksService {
  private readonly apiUrl = 'https://api.sportmonks.com/v3/football/players';
  private readonly apiKey = process.env.FOOTBALL_API_KEY;

  constructor(private readonly httpService: HttpService) {
    if (!this.apiKey) {
      throw new Error('The FOOTBALL_API_KEY environment variable is not set.');
    }
  }

  async getPlayerById(playerId: string): Promise<Player | null> {
    const url = `${this.apiUrl}/${playerId}?api_token=${this.apiKey}`;
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const playerData = response.data.data;

      if (!playerData) {
        throw new NotFoundException('Player not found in the API');
      }

      return playerData as Player;
    } catch (error: any) {
      console.error('Error fetching player from API:', error.message);
      throw new InternalServerErrorException('Failed to fetch player data from API');
    }
  }

  async searchPlayersByName(name: string): Promise<Player[]> {
    const url = `${this.apiUrl}/search/${name}?api_token=${this.apiKey}`;
    try {
        console.log("Looking for player: " + name);
        const response = await firstValueFrom(this.httpService.get(url));
        console.log("Response from API: " + response.data.data);
        const playersData = response.data.data;

        if (!playersData || playersData.length === 0) {
            return [];
        }


        return playersData.map((playerData: Player) => playerData);
    } catch (error: any) {
      console.error('Error searching players in API:', error.message);
      throw new InternalServerErrorException('Failed to fetch player data from API');
    }
  }
}
