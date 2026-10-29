import { Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { centerWhere } from '../utils/tenant';

// GET /api/admin/stats   (solo ADMIN, rol de plataforma)
export const getAdminStats = asyncHandler(async (_req: Request, res: Response) => {
  const [centers, users, subjects] = await Promise.all([
    prisma.educationalCenter.count(),
    prisma.user.count(),
    prisma.subject.count(),
  ]);
  res.json({ centers, users, subjects });
});

// GET /api/admin/search?query=texto&role=TEACHER   (ADMIN ve todo, CENTRO solo su propio centro)
export const adminSearch = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { query, role } = req.query as { query?: string; role?: string };

  const users = await prisma.user.findMany({
    where: {
      ...centerWhere(authReq),
      ...(role ? { role: role as RoleName } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: String(query), mode: 'insensitive' as const } },
              { email: { contains: String(query), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true, educationalCenterId: true, isActive: true },
    take: 20,
  });

  res.json(users);
});
