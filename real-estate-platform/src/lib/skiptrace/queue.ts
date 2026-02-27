/**
 * BullMQ queue and worker for skip-trace jobs.
 *
 * Queue: skip-trace
 * Worker: processes one job at a time (concurrency: 1) to avoid overwhelming REISkip API
 * Retries: 3 attempts with exponential backoff (2s, 4s, 8s)
 * Rate limiting: ~1 job/second via delay between enqueues
 *
 * Jobs are enqueued individually via enqueueSkipTrace().
 * The worker calls processSkipTraceJob() from processor.ts.
 */

import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { SkipTraceJobPayload } from './types';

// Reuse Redis connection config from environment
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

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

/**
 * skip-trace queue — holds pending lookup jobs.
 *
 * Default job options:
 * - 3 retry attempts with exponential backoff (2s base → 2s, 4s, 8s)
 * - Completed jobs retained 1 hour
 * - Failed jobs retained 48 hours (longer than follow-up for debugging)
 */
export const skipTraceQueue = new Queue('skip-trace', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 3600, // 1 hour
    },
    removeOnFail: {
      age: 172800, // 48 hours
    },
  },
});

/**
 * skip-trace worker — processes lookup jobs one at a time.
 *
 * concurrency: 1 prevents parallel REISkip calls from the same worker instance.
 * This keeps us well within REISkip's rate limits.
 */
export const skipTraceWorker = new Worker(
  'skip-trace',
  async (job: Job<SkipTraceJobPayload>) => {
    console.log(`[SkipTrace] Processing job ${job.id} for property ${job.data.propertyId}`);
    // Lazy import to avoid circular dependency (processor imports prisma and reiskip)
    const { processSkipTraceJob } = await import('./processor');
    return processSkipTraceJob(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 1,
    lockDuration: 60000, // 60s lock — REISkip calls can take up to 30s
    lockRenewTime: 30000, // Renew every 30s
  }
);

skipTraceWorker.on('failed', (job: Job<SkipTraceJobPayload> | undefined, err: Error) => {
  console.error(`[SkipTrace] Job ${job?.id} failed: ${err.message}`);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    console.error(
      `[SkipTrace] Job ${job.id} exhausted all retries for property ${job.data.propertyId}`
    );
  }
});

skipTraceWorker.on('completed', (job: Job<SkipTraceJobPayload>) => {
  console.log(`[SkipTrace] Job ${job.id} completed for property ${job.data.propertyId}`);
});

/**
 * Enqueue a single skip-trace lookup job.
 * Returns the BullMQ job ID.
 */
export async function enqueueSkipTrace(payload: SkipTraceJobPayload): Promise<string> {
  const jobId = `skip-trace-${payload.skipTraceRequestId}`;
  const job = await skipTraceQueue.add('lookup', payload, { jobId });
  console.log(`[SkipTrace] Enqueued job ${job.id} for property ${payload.propertyId}`);
  return job.id ?? jobId;
}

// Graceful shutdown — closes worker on SIGTERM
process.on('SIGTERM', async () => {
  console.log('[SkipTrace] Shutting down skip-trace worker...');
  await skipTraceWorker.close();
  process.exit(0);
});
