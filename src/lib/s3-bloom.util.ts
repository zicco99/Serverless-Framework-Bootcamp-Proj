import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { BloomFilter } from 'bloom-filters';
import streamToString from 'stream-to-string';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.REGION });

/**
 * Serializes a Bloom filter to a JSON string and uploads it to S3.
 * @param bucket - The name of the S3 bucket.
 * @param key - The key under which the Bloom filter will be stored.
 * @param bloomFilter - The Bloom filter to serialize and upload.
 */
export async function serializeAndUploadBloomFilter(bucket: string, key: string, bloomFilter: BloomFilter): Promise<void> {
  const bloomFilterData = JSON.stringify(bloomFilter.saveAsJSON());
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bloomFilterData,
      ContentType: 'application/json',
    }));
  } catch (err) {
    console.error(`Error uploading Bloom filter to bucket ${bucket}:`, err);
    throw new Error('Failed to upload Bloom filter');
  }
}

/**
 * Downloads a Bloom filter from S3 and deserializes it.
 * @param bucket - The name of the S3 bucket.
 * @param key - The key under which the Bloom filter is stored.
 * @returns The deserialized Bloom filter.
 */
export async function downloadAndDeserializeBloomFilter(bucket: string, key: string): Promise<BloomFilter> {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const data = await streamToString(response.Body as Readable);
    return BloomFilter.fromJSON(JSON.parse(data));
  } catch (err: any) {
    if (err.name === 'NoSuchKey') {
      console.log(`No Bloom filter found at ${bucket}/${key}, creating a new one.`);
      const bloomFilter = new BloomFilter(10000, 0.001);
      await serializeAndUploadBloomFilter(bucket, key, bloomFilter);
      return bloomFilter;
    }
    console.error(`Error loading Bloom filter from bucket ${bucket}:`, err);
    throw new Error('Failed to load Bloom filter');
  }
}
