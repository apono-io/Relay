export const PERSON_READ = 'person:read';
export const PERSON_WRITE = 'person:write';
export const IDENTITY_LINK = 'identity:link';
export const DASHBOARD_READ = 'dashboard:read';

export const ROLES = ['admin', 'developer', 'viewer'] as const;

export type RoleName = (typeof ROLES)[number];
