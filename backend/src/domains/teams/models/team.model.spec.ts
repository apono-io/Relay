import { ValidationPipe } from '@nestjs/common';
import { UpdateTeamInput } from './team.model';

// The app runs every input through this global pipe (main.ts); a field without a
// validator is stripped by `whitelist`, so updates must survive it.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: UpdateTeamInput });

describe('UpdateTeamInput through the global ValidationPipe', () => {
  it('keeps the name and lead', async () => {
    const input = {
      name: 'Platform',
      leadPersonId: '97f49137-0732-422d-a911-c8d5d9f690f3',
    };
    await expect(validate(input)).resolves.toEqual(input);
  });

  it('drops a per-team threshold, which is now one global setting', async () => {
    await expect(validate({ name: 'Platform', leadThreshold: 3 })).resolves.toEqual(
      { name: 'Platform' },
    );
  });

  it('keeps clearing the lead', async () => {
    await expect(validate({ leadPersonId: null })).resolves.toEqual({
      leadPersonId: null,
    });
  });

  it('rejects a lead that is not a person id', async () => {
    await expect(
      validate({ leadPersonId: 'not-a-uuid' }),
    ).rejects.toBeDefined();
  });
});
