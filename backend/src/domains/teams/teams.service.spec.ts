import { BadRequestException } from '@nestjs/common';
import { TeamsService } from './teams.service';

type Row = Record<string, any>;

// A tiny in-memory stand-in for a TypeORM repository: equality `where`, save, delete.
function fakeRepo(key: string) {
  let rows: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([field, value]) => row[field] === value);
  return {
    rows: () => rows,
    create: (value: Row) => ({ ...value }),
    find: jest.fn(async (options: { where?: Row } = {}) =>
      rows
        .filter((row) => matches(row, options.where))
        .map((row) => ({ ...row })),
    ),
    findOne: jest.fn(async (options: { where: Row }) => {
      const row = rows.find((candidate) => matches(candidate, options.where));
      return row ? { ...row } : null;
    }),
    save: jest.fn(async (value: Row) => {
      const saved = { ...value };
      if (saved[key] === undefined) {
        seq += 1;
        saved[key] = `${key}-${seq}`;
      }
      rows = rows.filter((row) => row[key] !== saved[key]).concat(saved);
      return { ...saved };
    }),
    delete: jest.fn(async (where: Row) => {
      const before = rows.length;
      rows = rows.filter((row) => !matches(row, where));
      return { affected: before - rows.length };
    }),
  };
}

function setup() {
  const teams = fakeRepo('id');
  const members = fakeRepo('personId');
  const service = new TeamsService(teams as never, members as never);
  return { service, teams, members };
}

describe('TeamsService', () => {
  it('creates a team with threshold 2 and no lead', async () => {
    const { service } = setup();
    const team = await service.create('  Platform ');
    expect(team).toMatchObject({
      name: 'Platform',
      leadPersonId: null,
      leadThreshold: 2,
      memberIds: [],
    });
  });

  it('rejects a duplicate team name', async () => {
    const { service } = setup();
    await service.create('Platform');
    await expect(service.create('Platform')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a threshold outside 1..20', async () => {
    const { service } = setup();
    const team = await service.create('Platform');
    await expect(service.update(team.id, { leadThreshold: 0 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.update(team.id, { leadThreshold: 21 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update(team.id, { leadThreshold: 1.5 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('moves a person who joins another team', async () => {
    const { service } = setup();
    const a = await service.create('A');
    const b = await service.create('B');
    await service.setMembers(a.id, ['p1', 'p2']);
    const { team, moved } = await service.setMembers(b.id, ['p1']);
    expect(moved).toEqual(['p1']);
    expect(team.memberIds).toEqual(['p1']);
    const [listedA] = (await service.list()).filter((t) => t.id === a.id);
    expect(listedA.memberIds).toEqual(['p2']);
  });

  it('making a member the lead of another team moves them', async () => {
    const { service } = setup();
    const a = await service.create('A');
    const b = await service.create('B');
    await service.setMembers(a.id, ['p1']);
    const updated = await service.update(b.id, { leadPersonId: 'p1' });
    expect(updated.leadPersonId).toBe('p1');
    const [listedA] = (await service.list()).filter((t) => t.id === a.id);
    expect(listedA.memberIds).toEqual([]);
  });

  it('rejects a lead who already leads another team', async () => {
    const { service } = setup();
    const a = await service.create('A');
    const b = await service.create('B');
    await service.update(a.id, { leadPersonId: 'p1' });
    await expect(service.update(b.id, { leadPersonId: 'p1' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('never lists the lead as a member', async () => {
    const { service } = setup();
    const a = await service.create('A');
    await service.update(a.id, { leadPersonId: 'lead' });
    const { team } = await service.setMembers(a.id, ['lead', 'p1']);
    expect(team.memberIds).toEqual(['p1']);
  });

  it('teamOf returns the membership team, else the led team, else null', async () => {
    const { service } = setup();
    const a = await service.create('A');
    const b = await service.create('B');
    await service.setMembers(a.id, ['p1']);
    await service.update(b.id, { leadPersonId: 'lead' });
    expect((await service.teamOf('p1'))?.name).toBe('A');
    expect((await service.teamOf('lead'))?.name).toBe('B');
    expect(await service.teamOf('nobody')).toBeNull();
  });

  it('removing a team frees its members', async () => {
    const { service } = setup();
    const a = await service.create('A');
    await service.setMembers(a.id, ['p1']);
    await expect(service.remove(a.id)).resolves.toBe(true);
    expect(await service.teamOf('p1')).toBeNull();
  });
});
