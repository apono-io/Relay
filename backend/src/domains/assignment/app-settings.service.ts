import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { AppSetting } from './entities/app-setting.entity';

const ACTUALLY_ASSIGN_KEY = 'assignment.actuallyAssign';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepo: Repository<AppSetting>,
    private readonly github: GitHubClient,
  ) {}

  async actuallyAssign(): Promise<boolean> {
    const row = await this.settingsRepo.findOne({
      where: { key: ACTUALLY_ASSIGN_KEY },
    });
    return row?.value === true;
  }

  async setActuallyAssign(enabled: boolean): Promise<boolean> {
    if (enabled && !this.github.canWrite()) {
      throw new BadRequestException(
        'Relay writes to GitHub only as its GitHub App. Set up the App credentials first, then turn this on.',
      );
    }
    await this.settingsRepo.save(
      this.settingsRepo.create({ key: ACTUALLY_ASSIGN_KEY, value: enabled }),
    );
    return enabled;
  }
}
