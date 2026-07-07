import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from './models/auth-user.model';

type GoogleProfile = {
  email: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  issueToken(profile: GoogleProfile): string {
    const payload = {
      sub: profile.email,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };
    return this.jwtService.sign(payload);
  }

  toAuthUser(user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
