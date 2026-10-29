import api from './api';

export type CalendarEventScope = 'PERSONAL' | 'CENTER' | 'SUBJECT';

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  scope: CalendarEventScope;
  subjectId: number | null;
  subject: { id: number; name: string; code: string } | null;
  ownerId: number | null;
  createdById: number;
  educationalCenterId: number | null;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  scope: CalendarEventScope;
  subjectId?: number;
  educationalCenterId?: number | null;
}

export interface UpdateEventPayload {
  title?: string;
  description?: string | null;
  location?: string | null;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
}

export const getEvents = async (from?: string, to?: string): Promise<CalendarEvent[]> => {
  const { data } = await api.get<CalendarEvent[]>('/calendar/events', { params: { from, to } });
  return data;
};

export const createEvent = async (payload: CreateEventPayload): Promise<CalendarEvent> => {
  const { data } = await api.post<CalendarEvent>('/calendar/events', payload);
  return data;
};

export const updateEvent = async (id: number, payload: UpdateEventPayload): Promise<CalendarEvent> => {
  const { data } = await api.patch<CalendarEvent>(`/calendar/events/${id}`, payload);
  return data;
};

export const deleteEvent = async (id: number): Promise<void> => {
  await api.delete(`/calendar/events/${id}`);
};
