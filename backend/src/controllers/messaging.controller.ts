import { Request, Response } from 'express';
import { ConversationType } from '@prisma/client';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';
import {
  getAllowedContactIds,
  canCreateGroupOrAnnouncement,
  canPostInAnnouncement,
  resolveConversationCenter,
} from '../services/messaging.policy';
import { notifyNewMessage } from '../services/notification.service';

const MESSAGE_PAGE_SIZE = 30;

/**
 * Falla con 403 si el usuario no es participante activo de la conversación. Devuelve el registro de participación.
 * Exportado porque documents.routes.ts / document.controller.ts (Bloque 6) necesita el mismo chequeo para
 * autorizar la descarga/borrado de un adjunto de mensaje.
 */
export async function assertConversationParticipant(conversationId: number, userId: number) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) {
    throw new HttpError(403, 'No eres participante de esta conversación');
  }
  return participant;
}

// GET /api/messages/contacts
export const getContacts = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const ids = await getAllowedContactIds(user);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const contacts = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json(contacts);
});

// POST /api/messages/conversations
// body: { type?: 'DIRECT'|'GROUP'|'ANNOUNCEMENT', participantIds: number[], subject?: string, firstMessage: string }
export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const { type, participantIds, subject, firstMessage } = req.body as {
    type?: ConversationType;
    participantIds?: number[];
    subject?: string;
    firstMessage?: string;
  };

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new HttpError(400, 'Debes indicar al menos un destinatario (participantIds)');
  }
  if (!firstMessage || !firstMessage.trim()) {
    throw new HttpError(400, 'El mensaje inicial (firstMessage) es obligatorio');
  }

  const cleanParticipantIds = Array.from(new Set(participantIds.filter((id) => id !== user.userId)));
  if (cleanParticipantIds.length === 0) {
    throw new HttpError(400, 'No puedes crear una conversación solo contigo mismo');
  }

  const conversationType: ConversationType =
    type ?? (cleanParticipantIds.length === 1 ? ConversationType.DIRECT : ConversationType.GROUP);

  if (conversationType !== ConversationType.DIRECT && !canCreateGroupOrAnnouncement(user.role)) {
    throw new HttpError(403, 'Tu rol no puede crear conversaciones grupales o anuncios');
  }

  const allowedIds = new Set(await getAllowedContactIds(user));
  const invalid = cleanParticipantIds.filter((id) => !allowedIds.has(id));
  if (invalid.length > 0) {
    throw new HttpError(403, `No tienes permiso para escribirle a los usuarios: ${invalid.join(', ')}`);
  }

  // DIRECT: si ya existe una conversación 1 a 1 entre ambos, se reutiliza (no se duplica el hilo)
  if (conversationType === ConversationType.DIRECT && cleanParticipantIds.length === 1) {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        participants: { some: { userId: user.userId } },
        AND: [{ participants: { some: { userId: cleanParticipantIds[0] } } }],
      },
    });
    if (existing) {
      const message = await createMessageInternal(existing.id, user.userId, firstMessage, existing.educationalCenterId);
      res.status(200).json({ conversationId: existing.id, message, reused: true });
      return;
    }
  }

  const allParticipantIds = Array.from(new Set([user.userId, ...cleanParticipantIds]));
  const centerId = await resolveConversationCenter(allParticipantIds);

  const conversation = await prisma.conversation.create({
    data: {
      type: conversationType,
      subject: subject ?? null,
      educationalCenterId: centerId,
      createdById: user.userId,
      participants: { create: allParticipantIds.map((id) => ({ userId: id })) },
      messages: { create: { senderId: user.userId, body: firstMessage, educationalCenterId: centerId } },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: true,
    },
  });

  await notifyNewMessage({
    conversationId: conversation.id,
    senderId: user.userId,
    senderName: (await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } }))?.name ?? 'Alguien',
    recipientIds: cleanParticipantIds,
    preview: firstMessage,
    educationalCenterId: centerId,
  });

  res.status(201).json(conversation);
});

// GET /api/messages/conversations  (inbox)
export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId, isArchived: false },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: { id: true, name: true, role: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  });

  const inbox = await Promise.all(
    participations.map(async (p) => {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          createdAt: { gt: p.lastReadAt ?? new Date(0) },
        },
      });
      return {
        conversationId: p.conversationId,
        type: p.conversation.type,
        subject: p.conversation.subject,
        participants: p.conversation.participants.map((cp) => cp.user),
        lastMessage: p.conversation.messages[0] ?? null,
        unreadCount,
        updatedAt: p.conversation.updatedAt,
      };
    })
  );

  res.json(inbox);
});

// GET /api/messages/conversations/:id?cursor=<messageId>
export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const conversationId = Number(req.params.id);
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

  await assertConversationParticipant(conversationId, userId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });
  if (!conversation) throw new HttpError(404, 'Conversación no encontrada');

  const messages = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    include: { attachments: true },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_PAGE_SIZE,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  res.json({
    conversation,
    messages: messages.reverse(),
    nextCursor: messages.length === MESSAGE_PAGE_SIZE ? messages[0]?.id : null,
  });
});

async function createMessageInternal(
  conversationId: number,
  senderId: number,
  body: string,
  educationalCenterId: number | null,
  file?: Express.Multer.File
) {
  const message = await prisma.message.create({
    data: { conversationId, senderId, body, educationalCenterId },
  });

  // Bloque 6: adjunto opcional en el mensaje.
  if (file) {
    await prisma.document.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: senderId,
        messageId: message.id,
        educationalCenterId,
      },
    });
  }

  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });

  await notifyNewMessage({
    conversationId,
    senderId,
    senderName: sender?.name ?? 'Alguien',
    recipientIds: participants.map((p) => p.userId),
    preview: body,
    educationalCenterId,
  });

  const messageWithAttachments = await prisma.message.findUnique({
    where: { id: message.id },
    include: { attachments: true },
  });
  return messageWithAttachments;
}

// POST /api/messages/conversations/:id/messages
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const conversationId = Number(req.params.id);
  const { body } = req.body as { body?: string };
  // Bloque 6: adjunto opcional (multipart, campo "file"; ver messaging.routes.ts).
  const file = (req as Express.Request & { file?: Express.Multer.File }).file;

  if ((!body || !body.trim()) && !file) {
    throw new HttpError(400, 'El mensaje debe tener texto o un archivo adjunto');
  }

  await assertConversationParticipant(conversationId, user.userId);

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new HttpError(404, 'Conversación no encontrada');

  if (conversation.type === ConversationType.ANNOUNCEMENT && !canPostInAnnouncement(conversation.createdById, user.userId)) {
    throw new HttpError(403, 'Solo quien creó el anuncio puede publicar en él');
  }

  const message = await createMessageInternal(
    conversationId,
    user.userId,
    body?.trim() ?? '',
    conversation.educationalCenterId,
    file
  );

  res.status(201).json(message);
});

// PATCH /api/messages/conversations/:id/read
export const markConversationRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const conversationId = Number(req.params.id);

  await assertConversationParticipant(conversationId, userId);

  const updated = await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  res.json(updated);
});

// PATCH /api/messages/conversations/:id/archive
export const archiveConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const conversationId = Number(req.params.id);
  const { archived } = req.body as { archived?: boolean };

  await assertConversationParticipant(conversationId, userId);

  const updated = await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { isArchived: archived ?? true },
  });

  res.json(updated);
});

// GET /api/messages/unread-count  (para el badge del navbar)
export const getGlobalUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId, isArchived: false },
    select: { conversationId: true, lastReadAt: true },
  });

  const counts = await Promise.all(
    participations.map((p) =>
      prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          createdAt: { gt: p.lastReadAt ?? new Date(0) },
        },
      })
    )
  );

  res.json({ count: counts.reduce((a, b) => a + b, 0) });
});
