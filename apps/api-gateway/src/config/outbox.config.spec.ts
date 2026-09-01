import { outboxConfig } from './outbox.config.js';

describe('outboxConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns safe dispatcher defaults', () => {
    vi.stubEnv('OUTBOX_DISPATCH_ENABLED', undefined);
    vi.stubEnv('OUTBOX_POLL_INTERVAL_MS', undefined);
    vi.stubEnv('OUTBOX_BATCH_SIZE', undefined);
    vi.stubEnv('OUTBOX_CLAIM_TTL_MS', undefined);

    expect(outboxConfig()).toEqual({
      dispatchEnabled: true,
      pollIntervalMs: 1000,
      batchSize: 10,
      claimTtlMs: 60_000,
    });
  });

  it('reads validated dispatcher settings from the environment', () => {
    vi.stubEnv('OUTBOX_DISPATCH_ENABLED', 'false');
    vi.stubEnv('OUTBOX_POLL_INTERVAL_MS', '2500');
    vi.stubEnv('OUTBOX_BATCH_SIZE', '25');
    vi.stubEnv('OUTBOX_CLAIM_TTL_MS', '120000');

    expect(outboxConfig()).toEqual({
      dispatchEnabled: false,
      pollIntervalMs: 2500,
      batchSize: 25,
      claimTtlMs: 120_000,
    });
  });
});
