import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '@/domains/assignment/entities/app-setting.entity';

const LAST_SYNCED_KEY = 'sync.lastSyncedAt';

@Injectable()
export class SyncStatusService implements OnModuleInit {
  private syncedAt: Date | null = null;

  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepo: Repository<AppSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    const row = await this.settingsRepo.findOne({
      where: { key: LAST_SYNCED_KEY },
    });
    if (typeof row?.value !== 'string') {
      return;
    }
    const stored = new Date(row.value);
    if (!Number.isNaN(stored.getTime())) {
      this.syncedAt = stored;
    }
  }

  get lastSyncedAt(): Date | null {
    return this.syncedAt;
  }

  async markSynced(at: Date): Promise<void> {
    if (this.syncedAt && at <= this.syncedAt) {
      return;
    }
    this.syncedAt = at;
    await this.settingsRepo.save(
      this.settingsRepo.create({
        key: LAST_SYNCED_KEY,
        value: at.toISOString(),
      }),
    );
  }
}
