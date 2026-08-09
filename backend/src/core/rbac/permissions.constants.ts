export const PERMISSIONS_KEY = 'relay:permissions';

export enum Role {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export enum Resource {
  PERSON = 'person',
  IDENTITY = 'identity',
  DASHBOARD = 'dashboard',
  SETTINGS = 'settings',
  ASSIGNMENT = 'assignment',
}

export enum Action {
  READ = 'read',
  WRITE = 'write',
  LINK = 'link',
  ADMIN = 'admin',
  WRITE_OWN = 'write-own',
  TRIGGER = 'trigger',
}

export const Permissions = {
  PERSON_READ: `${Resource.PERSON}:${Action.READ}`,
  PERSON_WRITE: `${Resource.PERSON}:${Action.WRITE}`,
  IDENTITY_LINK: `${Resource.IDENTITY}:${Action.LINK}`,
  DASHBOARD_READ: `${Resource.DASHBOARD}:${Action.READ}`,
  SETTINGS_ADMIN: `${Resource.SETTINGS}:${Action.ADMIN}`,
  SETTINGS_WRITE_OWN: `${Resource.SETTINGS}:${Action.WRITE_OWN}`,
  ASSIGNMENT_TRIGGER: `${Resource.ASSIGNMENT}:${Action.TRIGGER}`,
} as const;

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.ADMIN]: Object.values(Permissions),
  [Role.DEVELOPER]: [
    Permissions.DASHBOARD_READ,
    Permissions.PERSON_READ,
    Permissions.IDENTITY_LINK,
    Permissions.SETTINGS_WRITE_OWN,
    Permissions.ASSIGNMENT_TRIGGER,
  ],
  [Role.VIEWER]: [Permissions.DASHBOARD_READ],
};

export const DEFAULT_ROLE = Role.DEVELOPER;

export function isValidRole(role: string): role is Role {
  return Object.values(Role).includes(role as Role);
}

export function getPermissionsForRole(role: string | undefined): string[] {
  const resolved = role && isValidRole(role) ? role : DEFAULT_ROLE;
  return ROLE_PERMISSIONS[resolved];
}
