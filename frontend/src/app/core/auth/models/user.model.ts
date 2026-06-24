export type UserRole = 'member' | 'leader' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  groups: string[];
  roles: UserRole[];
}
