import { Injectable } from '@nestjs/common';
import { BloomFilter } from 'bloom-filters';
import { serializeAndUploadBloomFilter, downloadAndDeserializeBloomFilter } from './s3-bloom.util';

/**
 * BloomFilterManagerService class manages Bloom filters stored in S3.
 */
@Injectable()
export class BloomFilterManagerService {
  private readonly bloomFilterCache = new Map<string, BloomFilter>();

  constructor(private readonly bucketPrefix: string) {}

  /**
   * Retrieves a Bloom filter for a specific bucket, either from cache or by loading from S3.
   * @param bucketSuffix - The suffix of the S3 bucket (e.g., unique for each filter).
   * @returns The Bloom filter.
   */
  async getBloomFilter(bucketSuffix: string): Promise<BloomFilter> {
    const bucket = `${this.bucketPrefix}_${bucketSuffix}`;
    const key = this.getBloomFilterKey(bucketSuffix);

    if (!this.bloomFilterCache.has(bucket)) {
      const bloomFilter = await downloadAndDeserializeBloomFilter(bucket, key);
      this.bloomFilterCache.set(bucket, bloomFilter);
    }
    return this.bloomFilterCache.get(bucket) as BloomFilter;
  }

  /**
   * Saves a Bloom filter to an S3 bucket.
   * @param bucketSuffix - The suffix of the S3 bucket.
   * @param bloomFilter - The Bloom filter to save.
   */
  async saveBloomFilter(bucketSuffix: string, bloomFilter: BloomFilter): Promise<void> {
    const bucket = `${this.bucketPrefix}_${bucketSuffix}`;
    const key = this.getBloomFilterKey(bucketSuffix);
    await serializeAndUploadBloomFilter(bucket, key, bloomFilter);
  }

  /**
   * Generates the S3 key for storing the Bloom filter.
   * @param bucketSuffix - The suffix of the S3 bucket.
   * @returns The S3 key for the Bloom filter.
   */
  private getBloomFilterKey(bucketSuffix: string): string {
    return `${bucketSuffix}/bloomfilter.json`;
  }
}
