import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService, OAuthProfile } from './auth.service';
import { GithubLinkService } from './github-link.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly githubLinkService: GithubLinkService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.redirectWithToken(res, req.user as OAuthProfile);
  }

  @Get('dev-login')
  async devLogin(@Res() res: Response): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev login is disabled in production');
    }
    await this.redirectWithToken(res, {
      email: 'dev@apono.io',
      name: 'Dev User',
    });
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      res.redirect(`${this.frontendOrigin()}/people?link=failed`);
      return;
    }
    try {
      const { login } = await this.githubLinkService.completeLink(code, state);
      res.redirect(
        `${this.frontendOrigin()}/people?link=${encodeURIComponent(login)}`,
      );
    } catch (error) {
      const reason = encodeURIComponent((error as Error).message);
      res.redirect(
        `${this.frontendOrigin()}/people?link=failed&reason=${reason}`,
      );
    }
  }

  private async redirectWithToken(
    res: Response,
    profile: OAuthProfile,
  ): Promise<void> {
    try {
      const token = await this.authService.issueToken(profile);
      res.redirect(`${this.frontendOrigin()}/auth/callback?token=${token}`);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        res.redirect(`${this.frontendOrigin()}/login?error=deactivated`);
        return;
      }
      throw error;
    }
  }

  private frontendOrigin(): string {
    return (
      this.configService.get<string>('FRONTEND_ORIGIN') ||
      'http://localhost:5173'
    );
  }
}
