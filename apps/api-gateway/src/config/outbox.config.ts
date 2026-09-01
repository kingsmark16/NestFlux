import { registerAs } from '@nestjs/config';

export const outboxConfig = registerAs('outbox', () => ({
  dispatchEnabled: process.env.OUTBOX_DISPATCH_ENABLED !== 'false',
  pollIntervalMs: Number.parseInt(
    process.env.OUTBOX_POLL_INTERVAL_MS ?? '1000',
    10,
  ),
  batchSize: Number.parseInt(process.env.OUTBOX_BATCH_SIZE ?? '10', 10),
  claimTtlMs: Number.parseInt(process.env.OUTBOX_CLAIM_TTL_MS ?? '60000', 10),
}));
