import { RedisClient } from 'bun';
import { env } from '../constants';

/** Shared Redis connection (Bun's built-in client). */
let client: RedisClient | undefined;
export const redis = () => (client ??= new RedisClient(env.REDIS_URL));
export type Redis = RedisClient;
