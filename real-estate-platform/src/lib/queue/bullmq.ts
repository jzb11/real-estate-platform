import { Queue, Worker, QueueEvents } from 'bullmq';
import type { Job } from 'bullmq';
import type { FollowUpJobPayload } from './jobs';

// Use Redis URL from environment (same Redis as Phase 1 caching)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL to object format for BullMQ
function parseRedisUrl(url: string): Record<string, unknown> {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

const redisConnection = parseRedisUrl(redisUrl);

export const followUpQueue = new Queue('follow-up-sequences', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5, // Retry up to 5 times
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s, 8s, 16s
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours for debugging
    },
  },
});

const queueEvents = new QueueEvents('follow-up-sequences', {
  connection: redisConnection,
});

// Lazy-loaded executeSequenceStep to avoid circular imports
async function getExecutor(): Promise<(payload: FollowUpJobPayload) => Promise<unknown>> {
  const { executeSequenceStep } = await import('@/lib/automation/sequenceExecutor');
  return executeSequenceStep;
}

// Job handler — process one job at a time to avoid race conditions
export const followUpWorker = new Worker(
  'follow-up-sequences',
  async (job: Job<FollowUpJobPayload>) => {
    console.log(`Processing follow-up job: ${job.id}`);
    const executor = await getExecutor();
    return executor(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 1, // One job at a time
    lockDuration: 30000, // 30s lock
    lockRenewTime: 15000, // Renew every 15s
  }
);

// Event listeners for monitoring
followUpWorker.on('failed', (job: Job<FollowUpJobPayload> | undefined, err: Error) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
  // Alert if job exhausts all retries
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    console.error(`Job ${job.id} exhausted all ${job.opts.attempts} retries`);
  }
});

followUpWorker.on('completed', (job: Job<FollowUpJobPayload>) => {
  console.log(`Job ${job.id} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
  console.error(`Queue event: Job ${jobId} failed: ${failedReason}`);
});

export async function registerJobHandlers() {
  // Handler already registered above via Worker
  console.log('BullMQ job handlers registered');
}

// Graceful cleanup
process.on('SIGTERM', async () => {
  console.log('Shutting down BullMQ worker...');
  await followUpWorker.close();
  await queueEvents.close();
  process.exit(0);
});
