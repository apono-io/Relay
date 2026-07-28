import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import {
  Permissions,
  Role,
  getPermissionsForRole,
} from './permissions.constants';

function contextFor(role?: string): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => (role ? { user: { role } } : {}),
    }),
  } as unknown as ExecutionContext;
}

function guardRequiring(...permissions: string[]): PermissionsGuard {
  const reflector = {
    getAllAndOverride: () => permissions,
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('role permissions', () => {
  it('gives an admin the roster write permission', () => {
    expect(getPermissionsForRole(Role.ADMIN)).toContain(
      Permissions.PERSON_WRITE,
    );
  });

  it('withholds the roster write permission from a developer', () => {
    expect(getPermissionsForRole(Role.DEVELOPER)).not.toContain(
      Permissions.PERSON_WRITE,
    );
  });

  it('gives a viewer the dashboard only', () => {
    expect(getPermissionsForRole(Role.VIEWER)).toEqual([
      Permissions.DASHBOARD_READ,
    ]);
  });

  it('falls back to the default role for an unknown or missing role', () => {
    expect(getPermissionsForRole('nonsense')).toEqual(
      getPermissionsForRole(Role.DEVELOPER),
    );
    expect(getPermissionsForRole(undefined)).toEqual(
      getPermissionsForRole(Role.DEVELOPER),
    );
  });
});

describe('PermissionsGuard', () => {
  it('allows a resolver that requires nothing', () => {
    expect(guardRequiring().canActivate(contextFor(Role.VIEWER))).toBe(true);
  });

  it('allows a caller holding the permission', () => {
    const guard = guardRequiring(Permissions.PERSON_WRITE);
    expect(guard.canActivate(contextFor(Role.ADMIN))).toBe(true);
  });

  it('rejects a caller missing the permission (AC-12)', () => {
    const guard = guardRequiring(Permissions.PERSON_WRITE);
    expect(() => guard.canActivate(contextFor(Role.DEVELOPER))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a request that carries no user', () => {
    const guard = guardRequiring(Permissions.PERSON_READ);
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
