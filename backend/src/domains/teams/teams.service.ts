import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';

export type TeamView = {
  id: string;
  name: string;
  leadPersonId: string | null;
  leadThreshold: number;
  memberIds: string[];
};

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 20;

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly memberRepo: Repository<TeamMember>,
  ) {}

  async list(): Promise<TeamView[]> {
    const [teams, members] = await Promise.all([
      this.teamRepo.find(),
      this.memberRepo.find(),
    ]);
    return teams
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => this.view(team, members));
  }

  async create(name: string): Promise<TeamView> {
    const trimmed = await this.validName(name);
    const team = await this.teamRepo.save(
      this.teamRepo.create({
        name: trimmed,
        leadPersonId: null,
        leadThreshold: 2,
      }),
    );
    return this.view(team, []);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      leadPersonId?: string | null;
      leadThreshold?: number;
    },
  ): Promise<TeamView> {
    const team = await this.mustFind(id);
    if (patch.name !== undefined) {
      team.name = await this.validName(patch.name, id);
    }
    if (patch.leadThreshold !== undefined) {
      const threshold = patch.leadThreshold;
      if (
        !Number.isInteger(threshold) ||
        threshold < MIN_THRESHOLD ||
        threshold > MAX_THRESHOLD
      ) {
        throw new BadRequestException(
          `The lead threshold is a whole number from ${MIN_THRESHOLD} to ${MAX_THRESHOLD}.`,
        );
      }
      team.leadThreshold = threshold;
    }
    if (patch.leadPersonId !== undefined) {
      const leadPersonId = patch.leadPersonId || null;
      if (leadPersonId) {
        const leading = await this.teamRepo.findOne({
          where: { leadPersonId },
        });
        if (leading && leading.id !== id) {
          throw new BadRequestException(
            `That person already leads ${leading.name}. A person leads one team at most.`,
          );
        }
        // One team per person: a lead is never also a member of any team.
        await this.memberRepo.delete({ personId: leadPersonId });
      }
      team.leadPersonId = leadPersonId;
    }
    const saved = await this.teamRepo.save(team);
    return this.view(saved, await this.memberRepo.find());
  }

  async remove(id: string): Promise<boolean> {
    await this.mustFind(id);
    await this.memberRepo.delete({ teamId: id });
    await this.teamRepo.delete({ id });
    return true;
  }

  async setMembers(
    teamId: string,
    personIds: string[],
  ): Promise<{ team: TeamView; moved: string[] }> {
    const team = await this.mustFind(teamId);
    const wanted = [...new Set(personIds)].filter(
      (personId) => personId !== team.leadPersonId,
    );
    const existing = await this.memberRepo.find();
    const moved = existing
      .filter((row) => row.teamId !== teamId && wanted.includes(row.personId))
      .map((row) => row.personId);
    await this.memberRepo.delete({ teamId });
    for (const personId of wanted) {
      await this.memberRepo.save(this.memberRepo.create({ personId, teamId }));
    }
    return { team: this.view(team, await this.memberRepo.find()), moved };
  }

  // A person's team: the one they belong to, else the one they lead.
  async teamOf(personId: string): Promise<TeamView | null> {
    const membership = await this.memberRepo.findOne({ where: { personId } });
    const team = membership
      ? await this.teamRepo.findOne({ where: { id: membership.teamId } })
      : await this.teamRepo.findOne({ where: { leadPersonId: personId } });
    return team ? this.view(team, await this.memberRepo.find()) : null;
  }

  private async mustFind(id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`No team with id ${id}.`);
    }
    return team;
  }

  private async validName(name: string, ownId?: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('A team needs a name.');
    }
    const duplicate = await this.teamRepo.findOne({ where: { name: trimmed } });
    if (duplicate && duplicate.id !== ownId) {
      throw new BadRequestException(`A team named ${trimmed} already exists.`);
    }
    return trimmed;
  }

  private view(team: Team, members: TeamMember[]): TeamView {
    return {
      id: team.id,
      name: team.name,
      leadPersonId: team.leadPersonId ?? null,
      leadThreshold: team.leadThreshold,
      memberIds: members
        .filter((row) => row.teamId === team.id)
        .map((row) => row.personId)
        .filter((personId) => personId !== team.leadPersonId),
    };
  }
}
