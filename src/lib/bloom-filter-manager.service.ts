import { Injectable, Inject } from '@nestjs/common';
import { BloomFilter } from 'bloom-filters';
import { serializeAndUploadBloomFilter, downloadAndDeserializeBloomFilter } from './s3-bloom.util';

@Injectable()
export class BloomFilterManagerService {
  private readonly bloomFilterCache = new Map<string, BloomFilter>();


  async getBloomFilter(bucket_hash: string): Promise<BloomFilter> {
    if (!this.bloomFilterCache.has(bucket_hash)) {
      const bloomFilter = await downloadAndDeserializeBloomFilter(bucket_hash);
      this.bloomFilterCache.set(bucket_hash, bloomFilter);
    }
    return this.bloomFilterCache.get(bucket_hash)!;
  }

  async saveBloomFilter(bucket_hash: string, bloomFilter: BloomFilter): Promise<void> {
    await serializeAndUploadBloomFilter(bucket_hash, bloomFilter);
    this.bloomFilterCache.set(bucket_hash, bloomFilter);
  }

  getCache(): Map<string, BloomFilter> {
    return this.bloomFilterCache;
  }
}
