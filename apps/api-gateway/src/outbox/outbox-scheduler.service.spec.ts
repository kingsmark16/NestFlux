import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxDispatcher } from './outbox-dispatcher.service.js';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxScheduler } from './outbox-scheduler.service.js';

describe('OutboxScheduler', () => {
  const now = new Date('2026-09-01T04:00:00.000Z');
  const configValues: Record<string, boolean | number> = {
    'outbox.dispatchEnabled': true,
    'outbox.pollIntervalMs': 1000,
    'outbox.batchSize': 10,
    'outbox.claimTtlMs': 60_000,
  };

  const configService = {
    getOrThrow: vi.fn((key: string) => configValues[key]),
  };
  const schedulerRegistry = {
    addInterval: vi.fn(),
    doesExist: vi.fn(),
    deleteInterval: vi.fn(),
  };
  const outboxRepository = {
    releaseStaleClaims: vi.fn(),
  };
  const outboxDispatcher = {
    dispatchBatch: vi.fn(),
  };

  let scheduler: OutboxScheduler;
  let loggerError: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    configValues['outbox.dispatchEnabled'] = true;
    configValues['outbox.pollIntervalMs'] = 1000;
    configValues['outbox.batchSize'] = 10;
    configValues['outbox.claimTtlMs'] = 60_000;
    outboxRepository.releaseStaleClaims.mockResolvedValue(0);
    outboxDispatcher.dispatchBatch.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxScheduler,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: SchedulerRegistry,
          useValue: schedulerRegistry,
        },
        {
          provide: OutboxRepository,
          useValue: outboxRepository,
        },
        {
          provide: OutboxDispatcher,
          useValue: outboxDispatcher,
        },
      ],
    }).compile();

    scheduler = module.get(OutboxScheduler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('does not register or run when automatic dispatch is disabled', () => {
    configValues['outbox.dispatchEnabled'] = false;
    const runOnce = vi.spyOn(scheduler, 'runOnce');

    scheduler.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
    expect(runOnce).not.toHaveBeenCalled();
  });

  it('registers an interval and dispatches immediately at startup', () => {
    const runOnce = vi.spyOn(scheduler, 'runOnce').mockResolvedValue(0);

    scheduler.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
      'outbox-dispatch',
      expect.anything(),
    );
    expect(runOnce).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);

    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it('releases stale claims before dispatching the configured batch', async () => {
    outboxRepository.releaseStaleClaims.mockResolvedValue(2);
    outboxDispatcher.dispatchBatch.mockResolvedValue(3);

    await expect(scheduler.runOnce(now)).resolves.toBe(3);

    expect(outboxRepository.releaseStaleClaims).toHaveBeenCalledWith(
      new Date('2026-09-01T03:59:00.000Z'),
      now,
    );
    expect(outboxDispatcher.dispatchBatch).toHaveBeenCalledWith(10, now);
    expect(
      outboxRepository.releaseStaleClaims.mock.invocationCallOrder[0],
    ).toBeLessThan(outboxDispatcher.dispatchBatch.mock.invocationCallOrder[0]);
  });

  it('skips a tick while an earlier dispatch is still running', async () => {
    let finishRelease: (() => void) | undefined;
    outboxRepository.releaseStaleClaims.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          finishRelease = () => resolve(0);
        }),
    );
    outboxDispatcher.dispatchBatch.mockResolvedValue(1);

    const firstRun = scheduler.runOnce(now);

    await expect(scheduler.runOnce(now)).resolves.toBe(0);
    expect(outboxRepository.releaseStaleClaims).toHaveBeenCalledTimes(1);

    finishRelease?.();

    await expect(firstRun).resolves.toBe(1);
    expect(outboxDispatcher.dispatchBatch).toHaveBeenCalledTimes(1);
  });

  it('logs a generic error and permits a later retry', async () => {
    outboxRepository.releaseStaleClaims.mockRejectedValueOnce(
      new Error('postgresql://user:secret@localhost/nestflux'),
    );

    await expect(scheduler.runOnce(now)).resolves.toBe(0);

    expect(loggerError).toHaveBeenCalledWith('Outbox dispatch cycle failed');
    expect(loggerError).not.toHaveBeenCalledWith(
      expect.stringContaining('secret'),
    );

    outboxRepository.releaseStaleClaims.mockResolvedValueOnce(0);
    outboxDispatcher.dispatchBatch.mockResolvedValueOnce(1);

    await expect(scheduler.runOnce(now)).resolves.toBe(1);
  });

  it('removes its registered interval during application shutdown', () => {
    schedulerRegistry.doesExist.mockReturnValue(true);

    scheduler.onApplicationShutdown();

    expect(schedulerRegistry.doesExist).toHaveBeenCalledWith(
      'interval',
      'outbox-dispatch',
    );
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
      'outbox-dispatch',
    );
  });

  it('does not remove an interval that was never registered', () => {
    schedulerRegistry.doesExist.mockReturnValue(false);

    scheduler.onApplicationShutdown();

    expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
  });
});
