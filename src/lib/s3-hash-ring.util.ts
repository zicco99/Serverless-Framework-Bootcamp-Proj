import ConsistentHash from 'consistent-hash';
import { S3Client, PutObjectCommand, GetObjectCommand, SelectObjectContentCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
import streamToString from 'stream-to-string';
import { Readable } from 'stream';
import { BloomFilter } from 'bloom-filters';
import { BloomFilterManagerService } from './bloom-filter-manager.service';
import { NotFoundException } from '@nestjs/common';

export interface Entity {
}

export class S3HashRing<Entity, CreateEntityDTO extends object, UniqueAttributes extends object> {
  private readonly s3Client: S3Client;
  private readonly hashRing: ConsistentHash<string>;

  constructor(
    private readonly uniqueAttributeKeys: (keyof UniqueAttributes)[],
    readonly dtoToEntityMapper: (dto: CreateEntityDTO, id: string) => Entity,
    private readonly entityToUniqueAttributes: (entity: Entity) => UniqueAttributes,
    private readonly bloomFilterManager: BloomFilterManagerService // Ensure proper dependency injection
  ) {
    this.s3Client = new S3Client({ region: 'eu-west-1' });
    this.hashRing = new ConsistentHash<string>(100003, 40, 'random', (nodes: string[]) => nodes);
  }

  getBucket(attributes: UniqueAttributes): string {
    const bucketName = this.hashRing.get(this.createHash(attributes));
    return bucketName ? `${process.env.PLAYERS_BUCKET_NAME_PREFIX}_${bucketName}` : 'default-bucket';
  }

  createHash(attributes: UniqueAttributes): string {
    const values = Object.values(attributes as { [key: string]: string | number });
    const hashInput = values.map(value => String(value)).join(',');
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private buildS3SelectQuery(attributes: UniqueAttributes): string {
    return this.uniqueAttributeKeys
      .map(key => `${String(key)} = '${attributes[key]}'`)
      .join(' AND ');
  }

  private getBucketKey(bucket: string): string {
    return `${bucket}/data.json`;
  }

  async addEntity(dto: CreateEntityDTO): Promise<void> {
    const uniqueAttributes: UniqueAttributes = this.extractUniqueAttributes(dto);
    const id = this.createHash(uniqueAttributes);
    const entity: Entity = this.dtoToEntityMapper(dto, id);
    const bucket = this.getBucket(uniqueAttributes);

    try {
      const bloomFilter = await this.bloomFilterManager.getBloomFilter(bucket);

      if (bloomFilter.has(id)) {
        console.log(`Entity ID ${id} already exists in Bloom filter.`);
        throw new Error('Entity ID already exists in Bloom filter');
      }

      const data = await this.fetchData(bucket);
      const parsedData = JSON.parse(data) as Entity[];
      parsedData.push(entity);
      await this.uploadData(bucket, parsedData);

      bloomFilter.add(id);
      await this.bloomFilterManager.saveBloomFilter(bucket, bloomFilter);

    } catch (err) {
      console.error(`Error adding entity to bucket ${bucket}:`, err);
      throw new Error('Failed to add entity');
    }
  }

  async findOne(uniqueAttributes: UniqueAttributes): Promise<Entity | undefined> {
    const id = this.createHash(uniqueAttributes);
    const bucket = this.getBucket(uniqueAttributes);

    try {
      const bloomFilter = await this.bloomFilterManager.getBloomFilter(bucket);

      if (!bloomFilter.has(id)) {
        console.log(`Entity ID ${id} not found in Bloom filter.`);
        throw new NotFoundException(`Entity with ID ${id} not found`);
      }

      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: this.getBucketKey(bucket),
      }));
      const data = await streamToString(response.Body as Readable);
      const entities = JSON.parse(data) as Entity[];
      return entities.find(entity => this.createHash(this.entityToUniqueAttributes(entity)) === id);
    } catch (err) {
      console.error(`Error retrieving entity from bucket ${bucket}:`, err);
      throw new Error('Failed to retrieve entity');
    }
  }

  async findWithContinuationToken(
    uniqueAttributes: UniqueAttributes,
    limit: number = 10,
    continuationToken?: string
  ): Promise<{ entities: Entity[], nextToken?: string }> {
    const bucket = this.getBucket(uniqueAttributes);

    // Construct the query for S3 Select
    let query = `SELECT * FROM s3object WHERE ${this.buildS3SelectQuery(uniqueAttributes)}`;
    if (continuationToken) {
      query += ` AND id > '${continuationToken}'`;
    }

    try {
      const response = await this.s3Client.send(new SelectObjectContentCommand({
        Bucket: bucket,
        Key: this.getBucketKey(bucket),
        ExpressionType: 'SQL',
        Expression: query,
        InputSerialization: { JSON: { Type: 'DOCUMENT' } },
        OutputSerialization: { JSON: {} },
      }));

      const records = response.Payload;
      if (!records) return { entities: [], nextToken: undefined };

      const entities: Entity[] = [];
      let lastId: string | undefined;

      for await (const event of records) {
        if (event.Records && event.Records.Payload) {
          const payloadString = await streamToString(event.Records.Payload as unknown as Readable);
          const batch = JSON.parse(payloadString) as Entity[];
          entities.push(...batch);
          if (batch.length > 0) {
            lastId = this.createHash(this.entityToUniqueAttributes(batch[batch.length - 1]));
          }
        }
      }

      const nextToken = entities.length > limit ? lastId : undefined;
      return { entities: entities.slice(0, limit), nextToken };
    } catch (err) {
      console.error(`Error retrieving entities from bucket ${bucket}:`, err);
      throw new Error('Failed to retrieve entities');
    }
  }

  private async fetchData(bucket: string): Promise<string> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: this.getBucketKey(bucket) }));
      return await streamToString(response.Body as Readable);
    } catch (err: any) {
      if (err.name === 'NoSuchKey') {
        return JSON.stringify([]);
      }
      console.error(`Error fetching data from bucket ${bucket}:`, err);
      throw new Error('Failed to fetch data');
    }
  }

  private async uploadData(bucket: string, data: Entity[]): Promise<void> {
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: this.getBucketKey(bucket),
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      }));
    } catch (err) {
      console.error(`Error uploading data to bucket ${bucket}:`, err);
      throw new Error('Failed to upload data');
    }
  }

  private extractUniqueAttributes(dto: CreateEntityDTO): UniqueAttributes {
    const uniqueAttributes: Partial<UniqueAttributes> = {};

    for (const key of this.uniqueAttributeKeys) {
      if (key in dto) {
        uniqueAttributes[key as keyof UniqueAttributes] = dto[key as unknown as keyof CreateEntityDTO] as unknown as UniqueAttributes[keyof UniqueAttributes];
      }
    }
    return uniqueAttributes as UniqueAttributes;
  }
}
