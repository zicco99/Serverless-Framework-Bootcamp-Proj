import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import Redis from 'ioredis';
import Redlock from 'redlock';

@Injectable()
export class BotStateService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BotStateService.name);
  private redisClients: Redis[] = [];
  private redlock: Redlock;
  private readonly awsRegion = process.env.AWS_REGION;
  private readonly redisClusterId = process.env.BOT_STATE_REDIS_CLUSTER_ID;

  async onModuleInit() {
    await this.initializeRedis();
  }

  private async initializeRedis() {
    this.log.log('Connecting to AWS ElastiCache Redis Cluster...');
    const elastiCache = new AWS.ElastiCache({ region: this.awsRegion });

    try {
      const data = await elastiCache.describeCacheClusters({
        CacheClusterId: this.redisClusterId,
        ShowCacheNodeInfo: true,
      }).promise();

      const cacheNodes = data.CacheClusters?.[0]?.CacheNodes;
      if (cacheNodes && cacheNodes.length > 0) {
        this.redisClients = cacheNodes
          .map((node) => {
            if (node.Endpoint?.Address && node.Endpoint?.Port) {
              return new Redis({ host: node.Endpoint.Address, port: node.Endpoint.Port });
            }
          })
          .filter((redis): redis is Redis => redis !== undefined);

        this.redlock = new Redlock(this.redisClients, {
          driftFactor: 0.01,
          retryCount: 10,
          retryDelay: 200,
        });

        this.redisClients.forEach(redis => {
          redis.on('error', (err) => this.log.error('Redis error:', err));
          redis.on('connect', () => this.log.log('Connected to Redis'));
        });

        this.log.log(`Redis nodes connected: ${this.redisClients.map(redis => `${redis.options.host}:${redis.options.port}`).join(', ')}`);
      } else {
        this.log.error('No cache node endpoint found.');
        throw new Error('No cache node endpoint found.');
      }
    } catch (err) {
      this.log.error('Error fetching cache cluster info:', err);
      throw err;
    }
  }

  async getRedis() {
    if (this.redisClients.length === 0) {
      await this.initializeRedis();
    }
    return this.redisClients;
  }

  async getRedlock() {
    if (!this.redlock) {
      await this.initializeRedis();
    }
    return this.redlock;
  }

  async handleWithLock(userId: number, ttl: number, authAndSessionCheck: () => Promise<void>) {
    this.log.log(`User ${userId} acquiring lock for ${ttl} ms...`);
    const lockKey = `user:${userId}`;

    const redlock = await this.getRedlock();
    try {
      const lock = await redlock.acquire([lockKey], ttl);
      this.log.log('Lock acquired');

      try {
        await authAndSessionCheck();
      } catch (error) {
        this.log.error('Error in auth and session check:', error);
      } finally {
        await lock.release();
        this.log.log('Lock released');
      }
    } catch (error) {
      this.log.error('Error acquiring lock:', error);
      throw error;
    }
  }

  onModuleDestroy() {
    this.redisClients.forEach(redis => redis.quit());
  }
}
