import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';

// GET /api/notifications
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

// GET /api/notifications/unread-count
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  res.json({ count });
});

// PATCH /api/notifications/:id/read
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const id = Number(req.params.id);

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new HttpError(404, 'Notificación no encontrada');
  if (notification.userId !== userId) throw new HttpError(403, 'No puedes modificar notificaciones de otro usuario');

  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  res.json(updated);
});

// PATCH /api/notifications/read-all
export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  res.json({ message: 'Todas las notificaciones marcadas como leídas' });
});
