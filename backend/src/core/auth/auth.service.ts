import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from './models/auth-user.model';
import { PeopleService } from '@/domains/people/people.service';
import { Role } from '@/core/rbac/permissions.constants';

export type OAuthProfile = {
  email: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  private readonly bootstrapAdminEmails: Set<string>;

  constructor(
    private readonly jwtService: JwtService,
    private readonly peopleService: PeopleService,
    private readonly configService: ConfigService,
  ) {
    this.bootstrapAdminEmails = new Set(
      (this.configService.get<string>('ADMIN_EMAILS') ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    );
  }

  async issueToken(profile: OAuthProfile): Promise<string> {
    let person = await this.peopleService.ensurePerson(
      profile.email,
      profile.name,
    );
    if (
      this.bootstrapAdminEmails.has(person.email.toLowerCase()) &&
      (person.role !== Role.ADMIN || !person.active)
    ) {
      person = (await this.peopleService.update(person.id, {
        role: Role.ADMIN,
        active: true,
      }))!;
    }

    if (!person.active) {
      throw new ForbiddenException('This account is deactivated');
    }

    const payload = {
      sub: person.id,
      email: person.email,
      name: profile.name ?? person.displayName,
      picture: profile.picture,
      role: person.role,
    };
    return this.jwtService.sign(payload);
  }

  toAuthUser(user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
