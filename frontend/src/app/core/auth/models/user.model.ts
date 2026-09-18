export type UserRole = 'member' | 'leader' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  groupIds: number[];
  roles: UserRole[];
}
