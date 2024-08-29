import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppService } from './app.service';

@Controller('webhook')
export class AppController {
  constructor(private readonly telegramService: AppService) {}

  @Post()
  async handleUpdate(@Req() request: Request, @Res() response: Response): Promise<void> {
    const update = request.body;
    await this.telegramService.processUpdate(update);
    response.status(200).send('OK');
  }
}