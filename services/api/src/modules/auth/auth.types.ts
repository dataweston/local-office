import { UserRole } from '@local-office/db';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  roles: UserRole[];
  issuedAt: Date | null;
};
