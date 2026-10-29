import { Request, Response } from 'express';
import { NotificationType } from '@prisma/client';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';
import { loadSubjectOrThrow, assertCanAccessForum, canModerateSubject } from '../services/forum.policy';
import { createNotification } from '../services/notification.service';

const POST_PAGE_SIZE = 30;

// POST /api/forums/subjects/:subjectId/threads   (Maestro dueño de la materia, o Centro/Admin)
export const createThread = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const { title, body } = req.body as { title?: string; body?: string };

  if (!title?.trim() || !body?.trim()) {
    throw new HttpError(400, 'Título y contenido son obligatorios');
  }

  const subject = await loadSubjectOrThrow(subjectId);
  await assertCanAccessForum(user, subject);

  if (!canModerateSubject(user, subject)) {
    throw new HttpError(403, 'Solo el profesor de la materia (o Centro/Admin) puede crear temas');
  }

  const thread = await prisma.forumThread.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      subjectId,
      authorId: user.userId,
      educationalCenterId: subject.educationalCenterId,
    },
  });

  res.status(201).json(thread);
});

// GET /api/forums/subjects/:subjectId/threads
export const listThreads = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);

  const subject = await loadSubjectOrThrow(subjectId);
  await assertCanAccessForum(user, subject);

  const threads = await prisma.forumThread.findMany({
    where: { subjectId },
    include: {
      author: { select: { id: true, name: true, role: true } },
      _count: { select: { posts: true } },
    },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });

  res.json(threads);
});

// GET /api/forums/threads/:id?cursor=<postId>
export const getThread = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const threadId = Number(req.params.id);
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

  const thread = await prisma.forumThread.findUnique({
    where: { id: threadId },
    include: { subject: true, author: { select: { id: true, name: true, role: true } } },
  });
  if (!thread) throw new HttpError(404, 'Tema no encontrado');

  await assertCanAccessForum(user, thread.subject);

  const posts = await prisma.forumPost.findMany({
    where: { threadId, deletedAt: null },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
    take: POST_PAGE_SIZE,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  res.json({
    thread,
    posts,
    canModerate: canModerateSubject(user, thread.subject),
  });
});

// POST /api/forums/threads/:id/posts
export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const threadId = Number(req.params.id);
  const { body } = req.body as { body?: string };

  if (!body?.trim()) throw new HttpError(400, 'El mensaje no puede estar vacío');

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId }, include: { subject: true } });
  if (!thread) throw new HttpError(404, 'Tema no encontrado');

  await assertCanAccessForum(user, thread.subject);
  if (thread.isLocked) throw new HttpError(403, 'Este tema está cerrado, no admite nuevas respuestas');

  const post = await prisma.forumPost.create({
    data: {
      threadId,
      authorId: user.userId,
      body: body.trim(),
      educationalCenterId: thread.educationalCenterId,
    },
  });

  await prisma.forumThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // Notifica al autor del tema si alguien más responde (mismo patrón que mensajería)
  if (thread.authorId !== user.userId) {
    const sender = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    await createNotification({
      userId: thread.authorId,
      type: NotificationType.FORUM_REPLY,
      title: `${sender?.name ?? 'Alguien'} respondió en "${thread.title}"`,
      body: body.slice(0, 140),
      link: `/forums/threads/${threadId}`,
      educationalCenterId: thread.educationalCenterId,
    });
  }

  res.status(201).json(post);
});

// PATCH /api/forums/threads/:id/lock   body: { locked?: boolean }
export const setThreadLock = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const threadId = Number(req.params.id);
  const { locked } = req.body as { locked?: boolean };

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId }, include: { subject: true } });
  if (!thread) throw new HttpError(404, 'Tema no encontrado');

  if (!canModerateSubject(user, thread.subject)) {
    throw new HttpError(403, 'No tienes permiso para moderar este tema');
  }

  const updated = await prisma.forumThread.update({ where: { id: threadId }, data: { isLocked: locked ?? true } });
  res.json(updated);
});

// PATCH /api/forums/threads/:id/pin   body: { pinned?: boolean }
export const setThreadPin = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const threadId = Number(req.params.id);
  const { pinned } = req.body as { pinned?: boolean };

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId }, include: { subject: true } });
  if (!thread) throw new HttpError(404, 'Tema no encontrado');

  if (!canModerateSubject(user, thread.subject)) {
    throw new HttpError(403, 'No tienes permiso para moderar este tema');
  }

  const updated = await prisma.forumThread.update({ where: { id: threadId }, data: { isPinned: pinned ?? true } });
  res.json(updated);
});

// DELETE /api/forums/posts/:id   (autor propio, o quien puede moderar la materia)
export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const postId = Number(req.params.id);

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    include: { thread: { include: { subject: true } } },
  });
  if (!post) throw new HttpError(404, 'Mensaje no encontrado');

  const isOwnPost = post.authorId === user.userId;
  if (!isOwnPost && !canModerateSubject(user, post.thread.subject)) {
    throw new HttpError(403, 'No tienes permiso para borrar este mensaje');
  }

  await prisma.forumPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  res.json({ message: 'Mensaje eliminado' });
});
