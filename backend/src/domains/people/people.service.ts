import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Person } from './entities/person.entity';
import { LoggerService } from '@/infrastructure/logging/logger.service';

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  findAll(): Promise<Person[]> {
    return this.personRepo.find({ order: { email: 'ASC' } });
  }

  findByGithubLogin(githubLogin: string): Promise<Person | null> {
    return this.personRepo.findOne({ where: { githubLogin } });
  }

  async seedFromConfig(): Promise<void> {
    throw new Error('not implemented: seed roster from config/DB (spec task 12)');
  }

  async unmappedLogins(): Promise<string[]> {
    throw new Error('not implemented: report github logins seen in events but not mapped (spec §9)');
  }
}
