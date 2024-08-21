import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { BloomFilterManagerService } from '../lib/bloom-filter-manager.service';  // Adjust the path if needed
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  controllers: [PlayersController],
  providers: [
    PlayersService,
    {
      provide: BloomFilterManagerService,
      useFactory: () => {
        const bucketPrefixes = process.env.BUCKET_PREFIXES?.split(',') || ['default-prefix'];
        return new BloomFilterManagerService(bucketPrefixes);
      },
    },
    {
      provide: S3Client,
      useFactory: () => {
        return new S3Client({
          region: process.env.REGION || 'eu-west-1',
        });
      },
    },
  ],
})
export class PlayersModule {}