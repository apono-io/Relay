import { SyncStatusService } from './sync-status.service';

describe('SyncStatusService', () => {
  it('starts with no sync time', () => {
    expect(new SyncStatusService().lastSyncedAt).toBeNull();
  });

  it('remembers the latest sync time', () => {
    const service = new SyncStatusService();
    service.markSynced(new Date('2026-07-23T10:00:00Z'));
    service.markSynced(new Date('2026-07-23T11:00:00Z'));
    expect(service.lastSyncedAt).toEqual(new Date('2026-07-23T11:00:00Z'));
  });
});
