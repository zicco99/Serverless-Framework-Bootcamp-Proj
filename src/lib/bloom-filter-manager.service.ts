import { Injectable, Inject } from '@nestjs/common';
import { BloomFilter } from 'bloom-filters';
import { serializeAndUploadBloomFilter, downloadAndDeserializeBloomFilter } from './s3-bloom.util';

@Injectable()
export class BloomFilterManagerService {
  private readonly bloomFilterCache = new Map<string, BloomFilter>();
  private readonly bucketPrefixes: string[];

  constructor(@Inject('BUCKET_PREFIXES') bucketPrefixes: string[]) {
    this.bucketPrefixes = bucketPrefixes;
  }

  async getBloomFilter(bucketSuffix: string): Promise<BloomFilter> {
    const bucket = this.getBucketName(bucketSuffix);
    if (!this.bloomFilterCache.has(bucket)) {
      const key = this.getBloomFilterKey(bucketSuffix);
      const bloomFilter = await downloadAndDeserializeBloomFilter(bucket, key);
      this.bloomFilterCache.set(bucket, bloomFilter);
    }
    return this.bloomFilterCache.get(bucket)!;
  }

  async saveBloomFilter(bucketSuffix: string, bloomFilter: BloomFilter): Promise<void> {
    const bucket = this.getBucketName(bucketSuffix);
    const key = this.getBloomFilterKey(bucketSuffix);
    await serializeAndUploadBloomFilter(bucket, key, bloomFilter);
    this.bloomFilterCache.set(bucket, bloomFilter);
  }

  private getBucketName(bucketSuffix: string): string {
    // Assuming bucketSuffix is appended to each prefix
    const prefix = this.bucketPrefixes.find(p => bucketSuffix.startsWith(p));
    if (!prefix) {
      throw new Error(`No matching prefix found for bucketSuffix: ${bucketSuffix}`);
    }
    return `${prefix}_${bucketSuffix}`;
  }

  private getBloomFilterKey(bucketSuffix: string): string {
    return `${bucketSuffix}/bloomfilter.json`;
  }

  getCache(): Map<string, BloomFilter> {
    return this.bloomFilterCache;
  }
}
