import { Module, Global } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { AxiosInstance } from 'axios';

export const AXIOS_INSTANCE_TOKEN = 'AXIOS_INSTANCE';

@Global()
@Module({
  imports: [HttpModule],
  exports: [AXIOS_INSTANCE_TOKEN],
})
export class CustomAxiosModule {}
