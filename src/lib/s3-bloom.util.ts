import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { BloomFilter } from 'bloom-filters';
import streamToString from 'stream-to-string';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.REGION });

/**
 * Serializes a Bloom filter to a JSON string and uploads it to S3.
 * The Bloom filter will be stored in the path `/hash/bloomfilter.json`.
 * @param bucket - The name of the S3 bucket.
 * @param bloomFilter - The Bloom filter to serialize and upload.
 */
export async function serializeAndUploadBloomFilter(bucket_hash: string, bloomFilter: BloomFilter): Promise<void> {
  const key = `${bucket_hash}/bloomfilter.json`;

  const bloomFilterData = JSON.stringify(bloomFilter.saveAsJSON());

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket_hash,
      Key: key,
      Body: bloomFilterData,
      ContentType: 'application/json',
    }));
  } catch (err) {
    console.error(`Error uploading Bloom filter to bucket ${bucket_hash} at key ${key}:`, err);
    throw new Error('Failed to upload Bloom filter');
  }
}

/**
 * Downloads a Bloom filter from S3 and deserializes it.
 * @param bucket - The name of the S3 bucket.
 * @returns The deserialized Bloom filter. Creates a new Bloom filter if not found.
 */
export async function downloadAndDeserializeBloomFilter(bucket_hash: string): Promise<BloomFilter> {
  const key = `${bucket_hash}/bloomfilter.json`;

  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket_hash, Key: key }));

    // Ensure response.Body is a ReadableStream
    if (!(response.Body instanceof Readable)) {
      throw new Error('Response body is not a readable stream');
    }

    // Convert the stream to a string and parse the JSON
    const data = await streamToString(response.Body);
    return BloomFilter.fromJSON(JSON.parse(data));
  } catch (err: any) {
    if (err.name === 'NoSuchKey') {
      // Handle the case where the Bloom filter does not exist
      console.log(`No Bloom filter found at ${bucket_hash}/${key}. Creating a new one.`);
      const bloomFilter = new BloomFilter(10000, 0.001);
      await serializeAndUploadBloomFilter(bucket_hash, bloomFilter);
      return bloomFilter;
    }
    console.error(`Error loading Bloom filter from bucket ${bucket_hash} at key ${key}:`, err);
    throw new Error('Failed to load Bloom filter');
  }
}
