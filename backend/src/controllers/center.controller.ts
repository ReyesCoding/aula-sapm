import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';

// POST /api/centers   (solo ADMIN)
export const createCenter = asyncHandler(async (req: Request, res: Response) => {
  const { name, code, logoUrl } = req.body as { name?: string; code?: string; logoUrl?: string };
  if (!name || !code) throw new HttpError(400, 'Nombre y código son obligatorios');

  const exists = await prisma.educationalCenter.findUnique({ where: { code } });
  if (exists) throw new HttpError(409, 'Ya existe un centro con ese código');

  const center = await prisma.educationalCenter.create({ data: { name, code, logoUrl } });
  res.status(201).json(center);
});

// GET /api/centers   (solo ADMIN)
export const listCenters = asyncHandler(async (_req: Request, res: Response) => {
  const centers = await prisma.educationalCenter.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true, subjects: true } } },
  });
  res.json(centers);
});

// GET /api/centers/:id   (ADMIN, o CENTRO/otros roles viendo su propio centro)
export const getCenter = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const id = Number(req.params.id);

  if (user.role !== 'ADMIN' && user.educationalCenterId !== id) {
    throw new HttpError(403, 'No tienes acceso a este centro');
  }

  const center = await prisma.educationalCenter.findUnique({ where: { id } });
  if (!center) throw new HttpError(404, 'Centro no encontrado');
  res.json(center);
});

// PATCH /api/centers/:id   (solo ADMIN)
export const updateCenter = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, logoUrl, isActive } = req.body as { name?: string; logoUrl?: string; isActive?: boolean };

  const center = await prisma.educationalCenter.update({
    where: { id },
    data: { name, logoUrl, isActive },
  });
  res.json(center);
});

// POST /api/centers/:id/assign-user   (solo ADMIN) — equivalente al endpoint original del brief
export const assignUserToCenter = asyncHandler(async (req: Request, res: Response) => {
  const centerId = Number(req.params.id);
  const { userId } = req.body as { userId?: number };
  if (!userId) throw new HttpError(400, 'userId es obligatorio');

  const center = await prisma.educationalCenter.findUnique({ where: { id: centerId } });
  if (!center) throw new HttpError(404, 'Centro no encontrado');

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) throw new HttpError(404, 'Usuario no encontrado');
  if (targetUser.role === 'ADMIN') throw new HttpError(400, 'Un ADMIN de plataforma no pertenece a un centro');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { educationalCenterId: centerId },
    select: { id: true, name: true, email: true, role: true, educationalCenterId: true },
  });

  res.json(updated);
});
