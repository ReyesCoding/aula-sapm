import { Request, Response } from 'express';
import { RoleName, CalendarEventScope, CalendarEvent, Subject } from '@prisma/client';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';
import { loadSubjectOrThrow } from '../services/forum.policy';
import { canManageSubjectEvents, canManageCenterEvents, ownsCenterEvent, CalendarActor } from '../services/calendar.policy';
import { listVisibleEvents } from '../services/calendar.service';

function parseRequiredDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !value) throw new HttpError(400, `${field} es obligatorio`);
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new HttpError(400, `${field} no es una fecha válida`);
  return d;
}

// GET /api/calendar/events?from=&to=
export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user! as CalendarActor;
  const { from, to } = req.query as { from?: string; to?: string };

  const events = await listVisibleEvents(user, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  res.json(events);
});

// POST /api/calendar/events
// body: { title, description?, location?, startsAt, endsAt, allDay?, scope, subjectId?, educationalCenterId? }
export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user! as CalendarActor;
  const { title, description, location, startsAt, endsAt, allDay, scope, subjectId, educationalCenterId } =
    req.body as {
      title?: string;
      description?: string;
      location?: string;
      startsAt?: string;
      endsAt?: string;
      allDay?: boolean;
      scope?: CalendarEventScope;
      subjectId?: number;
      educationalCenterId?: number | null;
    };

  if (!title?.trim()) throw new HttpError(400, 'title es obligatorio');
  const start = parseRequiredDate(startsAt, 'startsAt');
  const end = parseRequiredDate(endsAt, 'endsAt');
  if (end < start) throw new HttpError(400, 'endsAt no puede ser anterior a startsAt');

  if (!scope || !Object.values(CalendarEventScope).includes(scope)) {
    throw new HttpError(400, 'scope debe ser CENTER, SUBJECT o PERSONAL');
  }

  const base = {
    title: title.trim(),
    description: description ?? null,
    location: location ?? null,
    startsAt: start,
    endsAt: end,
    allDay: !!allDay,
    createdById: user.userId,
  };

  if (scope === CalendarEventScope.PERSONAL) {
    const event = await prisma.calendarEvent.create({
      data: {
        ...base,
        scope: CalendarEventScope.PERSONAL,
        ownerId: user.userId,
        educationalCenterId: user.educationalCenterId,
      },
    });
    res.status(201).json(event);
    return;
  }

  if (scope === CalendarEventScope.CENTER) {
    if (!canManageCenterEvents(user)) {
      throw new HttpError(403, 'Solo Centro o Admin pueden crear eventos de centro');
    }
    // Admin puede fijar un centro específico (educationalCenterId) o dejarlo null (evento global).
    // Centro siempre crea dentro de su propio centro.
    const targetCenterId =
      user.role === RoleName.ADMIN && educationalCenterId !== undefined ? educationalCenterId : user.educationalCenterId;

    const event = await prisma.calendarEvent.create({
      data: {
        ...base,
        scope: CalendarEventScope.CENTER,
        educationalCenterId: targetCenterId,
      },
    });
    res.status(201).json(event);
    return;
  }

  // SUBJECT
  if (!subjectId) throw new HttpError(400, 'subjectId es obligatorio para eventos de materia');
  const subject = await loadSubjectOrThrow(Number(subjectId));
  if (!canManageSubjectEvents(user, subject)) {
    throw new HttpError(403, 'No tienes permiso para crear eventos en esta materia');
  }

  const event = await prisma.calendarEvent.create({
    data: {
      ...base,
      scope: CalendarEventScope.SUBJECT,
      subjectId: subject.id,
      educationalCenterId: subject.educationalCenterId,
    },
  });
  res.status(201).json(event);
});

async function assertCanMutateEvent(
  user: CalendarActor,
  event: CalendarEvent & { subject: Subject | null }
): Promise<void> {
  if (event.scope === CalendarEventScope.PERSONAL) {
    if (event.ownerId !== user.userId) {
      throw new HttpError(403, 'No puedes modificar un evento personal de otro usuario');
    }
    return;
  }

  if (event.scope === CalendarEventScope.CENTER) {
    if (!ownsCenterEvent(user, event.educationalCenterId)) {
      throw new HttpError(403, 'No tienes permiso para modificar este evento de centro');
    }
    return;
  }

  // SUBJECT
  if (!event.subject || !canManageSubjectEvents(user, event.subject)) {
    throw new HttpError(403, 'No tienes permiso para modificar este evento');
  }
}

// PATCH /api/calendar/events/:id
export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user! as CalendarActor;
  const id = Number(req.params.id);

  const event = await prisma.calendarEvent.findUnique({ where: { id }, include: { subject: true } });
  if (!event) throw new HttpError(404, 'Evento no encontrado');

  await assertCanMutateEvent(user, event);

  const { title, description, location, startsAt, endsAt, allDay } = req.body as {
    title?: string;
    description?: string | null;
    location?: string | null;
    startsAt?: string;
    endsAt?: string;
    allDay?: boolean;
  };

  const newStart = startsAt ? parseRequiredDate(startsAt, 'startsAt') : undefined;
  const newEnd = endsAt ? parseRequiredDate(endsAt, 'endsAt') : undefined;
  if (newStart && newEnd && newEnd < newStart) {
    throw new HttpError(400, 'endsAt no puede ser anterior a startsAt');
  }

  const updated = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...(title != null ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(newStart ? { startsAt: newStart } : {}),
      ...(newEnd ? { endsAt: newEnd } : {}),
      ...(allDay !== undefined ? { allDay } : {}),
    },
  });

  res.json(updated);
});

// DELETE /api/calendar/events/:id
export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user! as CalendarActor;
  const id = Number(req.params.id);

  const event = await prisma.calendarEvent.findUnique({ where: { id }, include: { subject: true } });
  if (!event) throw new HttpError(404, 'Evento no encontrado');

  await assertCanMutateEvent(user, event);

  await prisma.calendarEvent.delete({ where: { id } });
  res.json({ message: 'Evento eliminado' });
});
