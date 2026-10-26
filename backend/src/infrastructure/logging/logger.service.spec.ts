import { Logger } from '@nestjs/common';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['log', 'warn', 'debug'] as const)(
    '%s without a context passes only the message, so Nest prints no "undefined" line',
    (level) => {
      const spy = jest
        .spyOn(Logger.prototype, level)
        .mockImplementation(() => undefined);
      new LoggerService()[level]('Gap-fill done');
      expect(spy).toHaveBeenCalledWith('Gap-fill done');
    },
  );

  it('passes the context through when there is one', () => {
    const spy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    new LoggerService().log('Gap-fill done', 'GapFillJob');
    expect(spy).toHaveBeenCalledWith('Gap-fill done', 'GapFillJob');
  });
});
