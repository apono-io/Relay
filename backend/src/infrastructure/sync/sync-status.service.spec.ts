import { SyncStatusService } from './sync-status.service';

function settingsRepo(stored?: unknown) {
  return {
    findOne: jest
      .fn()
      .mockResolvedValue(
        stored === undefined
          ? null
          : { key: 'sync.lastSyncedAt', value: stored },
      ),
    save: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value: unknown) => value),
  };
}

function build(stored?: unknown) {
  const repo = settingsRepo(stored);
  const service = new SyncStatusService(repo as never);
  return { service, repo };
}

describe('SyncStatusService', () => {
  it('starts with no sync time', () => {
    expect(build().service.lastSyncedAt).toBeNull();
  });

  it('hydrates the stored sync time on init', async () => {
    const { service } = build('2026-08-11T09:00:00.000Z');
    await service.onModuleInit();
    expect(service.lastSyncedAt).toEqual(new Date('2026-08-11T09:00:00Z'));
  });

  it('ignores a malformed stored value', async () => {
    const { service } = build('not-a-date');
    await service.onModuleInit();
    expect(service.lastSyncedAt).toBeNull();
  });

  it('remembers and persists the latest sync time', async () => {
    const { service, repo } = build();
    await service.markSynced(new Date('2026-07-23T10:00:00Z'));
    await service.markSynced(new Date('2026-07-23T11:00:00Z'));
    expect(service.lastSyncedAt).toEqual(new Date('2026-07-23T11:00:00Z'));
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'sync.lastSyncedAt',
        value: '2026-07-23T11:00:00.000Z',
      }),
    );
  });

  it('never moves the watermark backwards', async () => {
    const { service, repo } = build();
    await service.markSynced(new Date('2026-07-23T11:00:00Z'));
    await service.markSynced(new Date('2026-07-23T10:00:00Z'));
    expect(service.lastSyncedAt).toEqual(new Date('2026-07-23T11:00:00Z'));
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
