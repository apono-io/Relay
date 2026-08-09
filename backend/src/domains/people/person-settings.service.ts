import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssignmentModeValue,
  PersonSettings,
  isAssignmentMode,
} from './entities/person-settings.entity';

@Injectable()
export class PersonSettingsService {
  constructor(
    @InjectRepository(PersonSettings)
    private readonly settingsRepo: Repository<PersonSettings>,
  ) {}

  async modeFor(personId: string): Promise<AssignmentModeValue> {
    const row = await this.settingsRepo.findOne({ where: { personId } });
    return row?.assignmentMode ?? 'off';
  }

  async modesByPersonId(): Promise<Map<string, AssignmentModeValue>> {
    const rows = await this.settingsRepo.find();
    return new Map(rows.map((row) => [row.personId, row.assignmentMode]));
  }

  async setMode(personId: string, mode: string): Promise<AssignmentModeValue> {
    if (!isAssignmentMode(mode)) {
      throw new BadRequestException(
        'The assignment mode must be off, hybrid, or auto.',
      );
    }
    const existing = await this.settingsRepo.findOne({ where: { personId } });
    if (existing) {
      existing.assignmentMode = mode;
      await this.settingsRepo.save(existing);
    } else {
      await this.settingsRepo.save(
        this.settingsRepo.create({ personId, assignmentMode: mode }),
      );
    }
    return mode;
  }
}
