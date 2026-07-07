import { Controller, ForbiddenException, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    const token = this.authService.issueToken(req.user as any);
    res.redirect(`${this.frontendOrigin()}/auth/callback?token=${token}`);
  }

  @Get('dev-login')
  devLogin(@Res() res: Response): void {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev login is disabled in production');
    }
    const token = this.authService.issueToken({ email: 'dev@apono.io', name: 'Dev User' });
    res.redirect(`${this.frontendOrigin()}/auth/callback?token=${token}`);
  }

  private frontendOrigin(): string {
    return this.configService.get<string>('FRONTEND_ORIGIN') || 'http://localhost:5173';
  }
}
