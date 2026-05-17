import type { Role } from '@/shared/lib/can';

export type Me = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: Role;
  organizationIds: number[];
};
