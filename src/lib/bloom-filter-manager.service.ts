import { Injectable } from '@nestjs/common';
import { BloomFilter } from 'bloom-filters';
import { serializeAndUploadBloomFilter, downloadAndDeserializeBloomFilter } from './s3-bloom.util';

/**
 * BloomFilterManagerService class manages Bloom filters stored in S3.
 */

@Injectable()
export class BloomFilterManagerService {
  // Mark as private to protect internal state
  private readonly bloomFilterCache = new Map<string, BloomFilter>();

  constructor(private readonly bucketPrefix: string) {}

  /**
   * Retrieves a Bloom filter for a specific bucket, either from cache or by loading from S3.
   * @param bucketSuffix - The suffix of the S3 bucket (e.g., unique for each filter).
   * @returns The Bloom filter.
   */
  async getBloomFilter(bucketSuffix: string): Promise<BloomFilter> {
    const bucket = this.getBucketName(bucketSuffix);
    if (!this.bloomFilterCache.has(bucket)) {
      const key = this.getBloomFilterKey(bucketSuffix);
      const bloomFilter = await downloadAndDeserializeBloomFilter(bucket, key);
      this.bloomFilterCache.set(bucket, bloomFilter);
    }
    return this.bloomFilterCache.get(bucket)!; // Use non-null assertion because we checked existence
  }

  /**
   * Saves a Bloom filter to an S3 bucket and updates the cache.
   * @param bucketSuffix - The suffix of the S3 bucket.
   * @param bloomFilter - The Bloom filter to save.
   */
  async saveBloomFilter(bucketSuffix: string, bloomFilter: BloomFilter): Promise<void> {
    const bucket = this.getBucketName(bucketSuffix);
    const key = this.getBloomFilterKey(bucketSuffix);
    await serializeAndUploadBloomFilter(bucket, key, bloomFilter);
    this.bloomFilterCache.set(bucket, bloomFilter); // Update cache after saving
  }

  /**
   * Generates the S3 bucket name.
   * @param bucketSuffix - The suffix of the S3 bucket.
   * @returns The complete S3 bucket name.
   */
  private getBucketName(bucketSuffix: string): string {
    return `${this.bucketPrefix}_${bucketSuffix}`;
  }

  /**
   * Generates the S3 key for storing the Bloom filter.
   * @param bucketSuffix - The suffix of the S3 bucket.
   * @returns The S3 key for the Bloom filter.
   */
  private getBloomFilterKey(bucketSuffix: string): string {
    return `${bucketSuffix}/bloomfilter.json`;
  }

  /**
   * Retrieves the cached Bloom filters.
   * @returns A map of bucket names to Bloom filters.
   */
  getCache(): Map<string, BloomFilter> {
    return this.bloomFilterCache;
  }
}
