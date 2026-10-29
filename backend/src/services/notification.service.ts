import { NotificationType } from '@prisma/client';
import prisma from '../prisma/client';

/**
 * Servicio de notificaciones (v2.0). Punto único para crear notificaciones,
 * usado hoy por el Centro de Mensajería y pensado para que Tareas, Exámenes
 * y Calificaciones lo reutilicen más adelante sin duplicar lógica.
 */

export interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  educationalCenterId: number | null;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      educationalCenterId: input.educationalCenterId,
    },
  });
}

/**
 * Crea una notificación NEW_MESSAGE para cada participante de una conversación
 * distinto del emisor. Se llama tras crear un Message (ver messaging.controller.ts).
 */
export async function notifyNewMessage(params: {
  conversationId: number;
  senderId: number;
  senderName: string;
  recipientIds: number[];
  preview: string;
  educationalCenterId: number | null;
}) {
  const { conversationId, senderId, senderName, recipientIds, preview, educationalCenterId } = params;
  const targets = recipientIds.filter((id) => id !== senderId);
  if (targets.length === 0) return;

  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      type: NotificationType.NEW_MESSAGE,
      title: `Nuevo mensaje de ${senderName}`,
      body: preview.slice(0, 140),
      link: `/messages/conversations/${conversationId}`,
      educationalCenterId,
    })),
  });
}
