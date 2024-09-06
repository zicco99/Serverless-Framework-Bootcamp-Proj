import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import Redis from 'ioredis';
import Redlock from 'redlock';

let redisClients: Redis[] = [];
let redlock: Redlock | null = null;
let lastRefresh: number = 0;
const REFRESH_INTERVAL = 3 * 60 * 1000; // Redis Cluster Node Refresh: A setInterval is used to refresh the Redis cluster nodes every 45 seconds, clients are kept up-to-date, especially in dynamic cloud environments like AWS ElastiCache.

@Injectable()
export class BotStateService {
  private readonly log = new Logger(BotStateService.name);
  private readonly awsRegion = process.env.AWS_REGION;
  private readonly redisClusterId = process.env.BOT_STATE_REDIS_CLUSTER_ID;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.refreshInterval = setInterval(() => {
      this.initializeRedis().catch(err => this.log.error('Error refreshing Redis nodes:', err));
    }, REFRESH_INTERVAL);
  }

  private async initializeRedis() {
    console.log('Refreshing Redis Cluster nodes...');

    const now = Date.now();

    if (now - lastRefresh < REFRESH_INTERVAL && redisClients.length > 0) {
      // - Till interval is not expired and there are redis clients
      return;
    }

    const elastiCache = new AWS.ElastiCache({ region: this.awsRegion });

    try {
      const data = await elastiCache.describeCacheClusters({
        CacheClusterId: this.redisClusterId,
        ShowCacheNodeInfo: true,
      }).promise();

      const cacheNodes = data.CacheClusters?.[0]?.CacheNodes;
      if (cacheNodes && cacheNodes.length > 0) {
        const newRedisClients = await Promise.all(
          cacheNodes.map(async (node) => {
            const address = node.Endpoint?.Address;
            const port = node.Endpoint?.Port;

            if (address && port) {
              const existingClient = redisClients.find(client => 
                client.options.host === address &&
                client.options.port === port
              );

              if (existingClient) {
                try {
                  await existingClient.ping();
                } catch (err) {
                  return undefined;
                }
                return existingClient;
              } else {
                return new Redis({ host: address, port });
              }
            } else {
              this.log.warn('Skipping node with missing address or port.');
              return undefined;
            }
          })
        );

        redisClients = newRedisClients.filter((client): client is Redis => client !== undefined);

        this.log.log(`Redis nodes connected: ${redisClients.map(redis => `${redis.options.host}:${redis.options.port}`).join(', ')}`);

        redlock = new Redlock(redisClients, {
          driftFactor: 0.01,
          retryCount: 10,
          retryDelay: 200,
        });

        lastRefresh = Date.now();
      } else {
        this.log.error('No cache node endpoint found.');
        throw new Error('No cache node endpoint found.');
      }
    } catch (error) {
      this.log.error('Error refreshing Redis nodes:', error); 
      throw error;
    }
  }

  async getRedis() {
    if (redisClients.length === 0) {
      await this.initializeRedis();
    }
    return redisClients;
  }

  async getRedlock() {
    if (!redlock) {
      await this.initializeRedis();
    }
    return redlock!;
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
