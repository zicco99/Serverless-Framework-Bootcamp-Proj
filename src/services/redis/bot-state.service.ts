import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import Redis from 'ioredis';
import Redlock from 'redlock';

@Injectable()
export class BotStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotStateService.name);
  private redisClients: Redis[] = [];
  private redlock: Redlock;
  private readonly awsRegion = process.env.AWS_REGION;
  private readonly redisClusterId = process.env.BOT_STATE_REDIS_CLUSTER_ID;
  private readonly redisConnectionPromise: Promise<void>;

  constructor() {
    this.redisConnectionPromise = this.initializeRedis();
  }

  private async initializeRedis() {
    this.logger.log('Connecting to AWS ElastiCache Redis Cluster...');
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
          redis.on('error', (err) => this.logger.error('Redis error:', err));
          redis.on('connect', () => this.logger.log('Connected to Redis'));
        });

        this.logger.log(`Redis nodes connected: ${this.redisClients.map(redis => `${redis.options.host}:${redis.options.port}`).join(', ')}`);
      } else {
        this.logger.error('No cache node endpoint found.');
        process.exit(1);
      }
    } catch (err) {
      this.logger.error('Error fetching cache cluster info:', err);
      process.exit(1);
    }
  }

  public async getRedis() {
    await this.redisConnectionPromise;
    return this.redisClients;
  }

  public async getRedlock() {
    await this.redisConnectionPromise;
    return this.redlock;
  }

  public async handleWithLock(userId: number, ttl: number, action: () => Promise<void>) {
    const lockKey = `user_session:${userId}`;
    let lockAcquired = false;

    for (let retries = 0; retries < 10; retries++) {
      try {
        const lock = await this.redlock.acquire([lockKey], ttl);
        lockAcquired = true;

        try {
          await action();
        } finally {
          await lock.release();
        }

        break;
      } catch (error) {
        if (retries === 9) {
          this.logger.error('Error acquiring lock:', error);
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  onModuleDestroy() {
    this.redisClients.forEach(redis => redis.quit());
  }

  async onModuleInit() {
    await this.redisConnectionPromise;
  }
}
