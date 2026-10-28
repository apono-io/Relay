import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { AppSetting } from './entities/app-setting.entity';

const ACTUALLY_ASSIGN_KEY = 'assignment.actuallyAssign';
const TEAM_LEAD_THRESHOLD_KEY = 'assignment.teamLeadThreshold';
const DEFAULT_TEAM_LEAD_THRESHOLD = 2;
const MIN_TEAM_LEAD_THRESHOLD = 1;
const MAX_TEAM_LEAD_THRESHOLD = 20;

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
    // A switch saved on earlier still reads off while Relay cannot write as its App.
    return row?.value === true && this.github.canWrite();
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

  // One threshold for every team: @relay team asks a lead only when every other
  // member already has this many open reviews or more.
  async teamLeadThreshold(): Promise<number> {
    const row = await this.settingsRepo.findOne({
      where: { key: TEAM_LEAD_THRESHOLD_KEY },
    });
    return typeof row?.value === 'number'
      ? row.value
      : DEFAULT_TEAM_LEAD_THRESHOLD;
  }

  async setTeamLeadThreshold(value: number): Promise<number> {
    if (
      !Number.isInteger(value) ||
      value < MIN_TEAM_LEAD_THRESHOLD ||
      value > MAX_TEAM_LEAD_THRESHOLD
    ) {
      throw new BadRequestException(
        `The lead threshold is a whole number from ${MIN_TEAM_LEAD_THRESHOLD} to ${MAX_TEAM_LEAD_THRESHOLD}.`,
      );
    }
    await this.settingsRepo.save(
      this.settingsRepo.create({ key: TEAM_LEAD_THRESHOLD_KEY, value }),
    );
    return value;
  }
}
