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
  memberIds: string[];
};

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
      }),
    );
    return this.view(team, []);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      leadPersonId?: string | null;
    },
  ): Promise<TeamView> {
    const team = await this.mustFind(id);
    if (patch.name !== undefined) {
      team.name = await this.validName(patch.name, id);
    }
    const leadPersonId =
      patch.leadPersonId === undefined ? undefined : patch.leadPersonId || null;
    if (leadPersonId) {
      const leading = await this.teamRepo.findOne({
        where: { leadPersonId },
      });
      if (leading && leading.id !== id) {
        throw new BadRequestException(
          `That person already leads ${leading.name}. A person leads one team at most.`,
        );
      }
    }
    // The lead change and leaving any membership commit together or not at all.
    return this.teamRepo.manager.transaction(async (manager) => {
      const teams = manager.getRepository(Team);
      const members = manager.getRepository(TeamMember);
      if (leadPersonId !== undefined) {
        if (leadPersonId) {
          // One team per person: a lead is never also a member of any team.
          await members.delete({ personId: leadPersonId });
        }
        team.leadPersonId = leadPersonId;
      }
      const saved = await teams.save(team);
      return this.view(saved, await members.find());
    });
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
    // Replacing the list, moving people from other teams and freeing other teams' lead
    // slots happen in one transaction, so a failure never leaves a team half-emptied.
    return this.teamRepo.manager.transaction(async (manager) => {
      const teams = manager.getRepository(Team);
      const members = manager.getRepository(TeamMember);
      const existing = await members.find();
      const movedFromMembership = existing
        .filter((row) => row.teamId !== teamId && wanted.includes(row.personId))
        .map((row) => row.personId);
      // One team per person also covers leads: leading elsewhere ends when joining here.
      const leadingElsewhere = (await teams.find()).filter(
        (other) =>
          other.id !== teamId &&
          other.leadPersonId !== null &&
          wanted.includes(other.leadPersonId),
      );
      const formerLeads = leadingElsewhere.map(
        (other) => other.leadPersonId as string,
      );
      for (const other of leadingElsewhere) {
        other.leadPersonId = null;
        await teams.save(other);
      }
      await members.delete({ teamId });
      if (wanted.length > 0) {
        await members.upsert(
          wanted.map((personId) => ({ personId, teamId })),
          ['personId'],
        );
      }
      return {
        team: this.view(team, await members.find()),
        moved: [...new Set([...movedFromMembership, ...formerLeads])],
      };
    });
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
      memberIds: members
        .filter((row) => row.teamId === team.id)
        .map((row) => row.personId)
        .filter((personId) => personId !== team.leadPersonId),
    };
  }
}
