import { Injectable, Logger } from '@nestjs/common';

// Nest prints an `undefined` extra argument as its own log line, so only set
// arguments are passed on.
const defined = (...params: (string | undefined)[]): string[] =>
  params.filter((param): param is string => param !== undefined);

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('Relay');

  log(message: string, context?: string): void {
    this.logger.log(message, ...defined(context));
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, ...defined(context));
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, ...defined(trace, context));
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, ...defined(context));
  }
}
