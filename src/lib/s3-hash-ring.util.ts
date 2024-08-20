/**
 * **S3HashRing**: A class that manages data distribution and querying in Amazon S3 using consistent hashing.
 *
 * **Purpose**:
 * - Distributes data across multiple S3 buckets efficiently.
 * - Uses consistent hashing to determine the appropriate bucket for each piece of data.
 *
 * **Key Components**:
 * 1. **Consistent Hashing**:
 *    - Uses a hash ring to map data to buckets.
 *    - Helps in even data distribution and efficient retrieval.
 * 2. **Hash Ring Configuration**:
 *    - **`range`**: Defines the total number of positions on the hash ring (default: 100003, a large prime number for even distribution).
 *    - **`weight`**: Specifies the number of virtual nodes per bucket (default: 40, balancing between performance and distribution).
 * 3. **Data Operations**:
 *    - **Upload Data**: Computes a hash from the data, determines the bucket, and uploads the data to S3.
 *    - **Retrieve Data**: Computes the hash to locate the bucket and fetches the data from S3.
 *    - **Query Data**: Retrieves data from the primary bucket and optionally from nearby buckets to ensure completeness.
 *
 * **Usage**:
 * - Initialize `S3QueryLib` with S3 configuration and hash ring options.
 * - Use methods like `uploadData`, `retrieveData`, `queryData`, and `listObjects` to manage and access data.
 */

import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, SelectObjectContentCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto'; // For hashing
import streamToString from 'stream-to-string';
import { Readable } from 'stream'; // For TypeScript type checking
import ConsistentHash from 'consistent-hash'; // Adjust import if needed
import process from 'process';

// Define a generic DTO type with attributes used for hashing
export type EntityDto = {
  id: string;
  [key: string]: any;
};

@Injectable()
export class S3HashRing<Entity, EntityDto, UniqueAttributes> {
  private readonly s3Client = new S3Client({ region: 'eu-west-1' });
  private readonly PREFIX_BUCKET_NAME = process.env.PREFIX_BUCKET_NAME;
  private readonly hashRing: ConsistentHash<string>;

  private N_BUCKETS = parseInt(process.env.N_BUCKETS || '100', 10);

  constructor(
    private readonly uniqueAttributeKeys: (keyof UniqueAttributes)[],
    private readonly dtoToEntityMapper: (dto: EntityDto) => Entity,
    private readonly entityToUniqueAttributes: (entity: Entity) => UniqueAttributes
  ) {
    this.hashRing = new ConsistentHash<string>(
      100003, // Hash ring control point modulo range
      40, // Default number of control points per node
      'random', // Node arrangement around the ring
      (nodes: string[]) => nodes
    );

    // Initialize buckets in hash ring
    Array.from({ length: this.N_BUCKETS }, (_, i) => `bucket_${i}`).forEach(bucketName =>
      this.hashRing.add(bucketName)
    );
  }


  private getBucket(attributes: UniqueAttributes): string {
    return this.hashRing.get(this.createHash(attributes)) || 'default-bucket';
  }

  private async fetchData(bucket: string): Promise<string> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: this.getBucketKey(bucket) }));
      return await streamToString(response.Body as Readable);
    } catch (err: any) {
      if (err.name === 'NoSuchKey') return '[]';
      console.error(`Error fetching data from bucket ${bucket}:`, err);
      throw new Error('Failed to retrieve data');
    }
  }

  private async uploadData(bucket: string, data: Entity[]): Promise<void> {
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: this.getBucketKey(bucket),
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      }));
    } catch (err) {
      console.error(`Error uploading data to bucket ${bucket}:`, err);
      throw new Error('Failed to upload data');
    }
  }

  async addEntity(dto: EntityDto): Promise<void> {
    const entity = this.dtoToEntityMapper(dto);
    const attributes = this.entityToUniqueAttributes(entity);
    const bucket = this.getBucket(attributes);
    const data = await this.fetchData(bucket);
    const entities = JSON.parse(data) as Entity[];
    entities.push(entity);
    await this.uploadData(bucket, entities);
  }


  async getEntity(attributes: UniqueAttributes): Promise<Entity | undefined> {
    const bucket = this.getBucket(attributes);


    const query = `SELECT * FROM s3object WHERE ${this.buildS3SelectQuery(attributes)}`;
    const response = await this.s3Client.send(new SelectObjectContentCommand({
      Bucket: bucket,
      Key: this.getBucketKey(bucket),
      ExpressionType: 'SQL',
      Expression: query,
      InputSerialization: {
        JSON: { Type: 'DOCUMENT'  },
      },
      OutputSerialization: {
        JSON: {},
      },
    }));

    const records = response.Payload as Readable;
    for await (const event of records) {
      if (event.Records) {
        const data = await streamToString(event.Records);
        console.log(data)
        const entities = JSON.parse(data) as Entity[];
        return entities[0];
      }
    }

    return undefined;
  }

  
  async getEntities(attributes: UniqueAttributes): Promise<Entity[]> {
    const bucket = this.getBucket(attributes);
    const query = `SELECT * FROM s3object WHERE ${this.buildS3SelectQuery(attributes)}`;
  
    const response = await this.s3Client.send(new SelectObjectContentCommand({
      Bucket: bucket,
      Key: this.getBucketKey(bucket),
      ExpressionType: 'SQL',
      Expression: query,
      InputSerialization: { JSON: { Type: 'DOCUMENT' } },
      OutputSerialization: { JSON: {} },
    }));
  
    const records = response.Payload as Readable;
    console.log(records);
    const entities: Entity[] = [];
  
    for await (const event of records) {
      if (event.Records) {
        const data = await streamToString(event.Records);
        entities.push(...JSON.parse(data));
      }
    }
  
    return entities;
  }
  


  //Utility Stuff

  private getBucketKey(bucket: string): string {
    return `${bucket}.json`;
  }

  private createHash(attributes: UniqueAttributes): string {
    const hashInput = this.uniqueAttributeKeys
      .map(key => `${String(key)}:${attributes[key]}`)
      .join('|');
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private buildS3SelectQuery(attributes: UniqueAttributes): string {
    return this.uniqueAttributeKeys
      .map(key => `(${String(key)} = '${attributes[key]}')`)
      .join(' AND ');
  }
}
