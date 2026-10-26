import { BadRequestException } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';

function setup(canWrite: boolean) {
  const settingsRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value: unknown) => value),
  };
  const github = { canWrite: jest.fn().mockReturnValue(canWrite) };
  const service = new AppSettingsService(
    settingsRepo as never,
    github as never,
  );
  return { service, settingsRepo };
}

describe('AppSettingsService.setActuallyAssign', () => {
  it('refuses to turn on live assignment while Relay cannot write as its App', async () => {
    const { service, settingsRepo } = setup(false);
    await expect(service.setActuallyAssign(true)).rejects.toThrow(
      BadRequestException,
    );
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });

  it('turns live assignment on when Relay writes as its App', async () => {
    const { service, settingsRepo } = setup(true);
    await expect(service.setActuallyAssign(true)).resolves.toBe(true);
    expect(settingsRepo.save).toHaveBeenCalledWith({
      key: 'assignment.actuallyAssign',
      value: true,
    });
  });

  it('can always turn live assignment off', async () => {
    const { service, settingsRepo } = setup(false);
    await expect(service.setActuallyAssign(false)).resolves.toBe(false);
    expect(settingsRepo.save).toHaveBeenCalled();
  });

  it('reads as off while Relay cannot write as its App, even if it was saved on', async () => {
    const { service, settingsRepo } = setup(false);
    settingsRepo.findOne.mockResolvedValue({
      key: 'assignment.actuallyAssign',
      value: true,
    });
    await expect(service.actuallyAssign()).resolves.toBe(false);
  });

  it('reads as on when saved on and Relay writes as its App', async () => {
    const { service, settingsRepo } = setup(true);
    settingsRepo.findOne.mockResolvedValue({
      key: 'assignment.actuallyAssign',
      value: true,
    });
    await expect(service.actuallyAssign()).resolves.toBe(true);
  });
});
