import type { PickSignals } from '@/types/system';

export type RelayAssignment = {
  repo: string;
  number: number;
  login: string;
  displayName: string;
  shadow: boolean;
  trigger: string;
  assignedAt: string;
  area: string | null;
  reason: string | null;
  signals: PickSignals | null;
};

export type AssignmentMode = 'off' | 'hybrid' | 'auto';
