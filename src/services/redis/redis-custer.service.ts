import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import Redis from 'ioredis';
import Redlock from 'redlock';

let redisClients: Redis[] = [];
let redlock: Redlock | null = null;

@Injectable()
export class RedisClusterService {
  private readonly log = new Logger(RedisClusterService.name);
  private readonly awsRegion = process.env.AWS_REGION;
  private readonly redisClusterId = process.env.BOT_STATE_REDIS_CLUSTER_ID;
  private refreshInterval: NodeJS.Timeout | null = null;

  public async initializeRedis(lastRefresh = 0, REFRESH_INTERVAL = 3 * 60 * 1000) {
    this.log.log('Refreshing Redis Cluster nodes...');

    const now = Date.now();
    if (redisClients.length > 0 && (now - lastRefresh < REFRESH_INTERVAL)) {
      return;
    }

    const elastiCache = new AWS.ElastiCache({ region: this.awsRegion });

    try {
      const data = await elastiCache.describeCacheClusters({
        CacheClusterId: this.redisClusterId,
        ShowCacheNodeInfo: true,
      }).promise();

      const cacheNodes = data.CacheClusters?.[0]?.CacheNodes;
      if (!cacheNodes || cacheNodes.length === 0) {
        throw new Error('No cache node endpoint found.');
      }

      const newRedisClients = await Promise.all(
        cacheNodes.map(async (node) => {
          const address = node.Endpoint?.Address;
          const port = node.Endpoint?.Port;

          if (!address || !port) {
            this.log.warn('Skipping node with missing address or port.');
            return undefined;
          }

          const existingClient = redisClients.find(client => 
            client.options.host === address &&
            client.options.port === port
          );

          if (existingClient) {
            try {
              await existingClient.ping();
              return existingClient;
            } catch (err: any) {
              this.log.warn(`Existing Redis client failed to ping: ${err.message}`);
              return undefined;
            }
          } else {
            return new Redis({ host: address, port });
          }
        })
      );

      redisClients = newRedisClients.filter((client): client is Redis => client !== undefined);

      this.log.log(`Redis nodes connected: ${redisClients.map(redis => `${redis.options.host}:${redis.options.port}`).join(', ')}`);

      redlock = new Redlock(redisClients, {
        driftFactor: 0.01,
        retryCount: 10,
        retryDelay: 200,
        retryJitter: 200,
      });

      lastRefresh = Date.now();
    } catch (error) {
      this.log.error('Error refreshing Redis nodes:', error);
      throw error;
    }
  }

  async getRedis() {
    if (redisClients.length === 0) {
      await this.initializeRedis();
    }
    return redisClients[0]
  }

  async getRedlock() {
    if (!redlock) {
      await this.initializeRedis();
    }
    if (!redlock) {
      throw new Error('Redlock is not initialized.');
    }
    return redlock;
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
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    redisClients.forEach(redis => redis.quit());
  }
}
