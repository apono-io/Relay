import { Injectable } from '@nestjs/common';

@Injectable()
export class SyncStatusService {
  private syncedAt: Date | null = null;

  get lastSyncedAt(): Date | null {
    return this.syncedAt;
  }

  markSynced(at: Date): void {
    this.syncedAt = at;
  }
}
