import { RoleName } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: RoleName;
      };
    }
  }
}
export {};