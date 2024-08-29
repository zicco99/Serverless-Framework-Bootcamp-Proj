import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({
  imports: [
    TelegrafModule
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
