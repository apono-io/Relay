import { ValidationPipe } from '@nestjs/common';
import { UpdateTeamInput } from './team.model';

// The app runs every input through this global pipe (main.ts); a field without a
// validator is stripped by `whitelist`, so updates must survive it.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: UpdateTeamInput });

describe('UpdateTeamInput through the global ValidationPipe', () => {
  it('keeps the name, lead and threshold', async () => {
    const input = {
      name: 'Platform',
      leadPersonId: '97f49137-0732-422d-a911-c8d5d9f690f3',
      leadThreshold: 3,
    };
    await expect(validate(input)).resolves.toEqual(input);
  });

  it('keeps clearing the lead', async () => {
    await expect(validate({ leadPersonId: null })).resolves.toEqual({
      leadPersonId: null,
    });
  });

  it('rejects a threshold outside 1..20', async () => {
    await expect(validate({ leadThreshold: 0 })).rejects.toBeDefined();
    await expect(validate({ leadThreshold: 21 })).rejects.toBeDefined();
  });

  it('rejects a lead that is not a person id', async () => {
    await expect(
      validate({ leadPersonId: 'not-a-uuid' }),
    ).rejects.toBeDefined();
  });
});
