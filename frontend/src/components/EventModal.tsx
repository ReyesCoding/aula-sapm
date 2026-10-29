import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSubjects, type Subject } from '../services/subject.service';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  type CalendarEvent,
  type CalendarEventScope,
} from '../services/calendar.service';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Fecha por defecto (yyyy-mm-dd) al crear un evento nuevo, p.ej. el día clickeado en el grid. */
  defaultDate?: string;
  /** Si se pasa, el modal edita este evento en vez de crear uno nuevo. */
  event?: CalendarEvent | null;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const EventModal = ({ isOpen, onClose, onSaved, defaultDate, event }: EventModalProps) => {
  const { user } = useAuth();
  const isEditing = !!event;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [scope, setScope] = useState<CalendarEventScope>('PERSONAL');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [allDay, setAllDay] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreateCenter = user?.role === 'CENTRO' || user?.role === 'ADMIN';
  const canCreateSubject = user?.role === 'TEACHER' || user?.role === 'CENTRO' || user?.role === 'ADMIN';

  const mySubjects =
    user?.role === 'TEACHER' ? subjects.filter((s) => s.teacher?.id === user.id) : subjects;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (canCreateSubject) {
      getSubjects().then(setSubjects).catch(() => setSubjects([]));
    }

    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setScope(event.scope);
      setSubjectId(event.subjectId || '');
      setStartsAt(toLocalInputValue(event.startsAt));
      setEndsAt(toLocalInputValue(event.endsAt));
      setAllDay(event.allDay);
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setScope('PERSONAL');
      setSubjectId('');
      const base = defaultDate || new Date().toISOString().slice(0, 10);
      setStartsAt(`${base}T09:00`);
      setEndsAt(`${base}T10:00`);
      setAllDay(false);
    }
  }, [isOpen, event, defaultDate, canCreateSubject]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (new Date(endsAt) < new Date(startsAt)) {
      setError('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    if (!isEditing && scope === 'SUBJECT' && !subjectId) {
      setError('Selecciona una materia.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (isEditing && event) {
        await updateEvent(event.id, {
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          allDay,
        });
      } else {
        await createEvent({
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          allDay,
          scope,
          subjectId: scope === 'SUBJECT' ? Number(subjectId) : undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al guardar el evento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      setDeleting(true);
      await deleteEvent(event.id);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al eliminar el evento.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-violet-600 px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <h3 className="font-bold text-lg">{isEditing ? 'Editar Evento' : 'Nuevo Evento'}</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!isEditing && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de evento</label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setScope('PERSONAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${scope === 'PERSONAL' ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600'}`}>
                  Personal
                </button>
                {canCreateCenter && (
                  <button type="button" onClick={() => setScope('CENTER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${scope === 'CENTER' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                    Centro
                  </button>
                )}
                {canCreateSubject && (
                  <button type="button" onClick={() => setScope('SUBJECT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${scope === 'SUBJECT' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 text-gray-600'}`}>
                    Materia
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEditing && scope === 'SUBJECT' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Materia</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
              >
                <option value="">Selecciona una materia...</option>
                {mySubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
              placeholder="Ej: Reunión de padres"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Inicio</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Fin</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
            Todo el día
          </label>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Ubicación (opcional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción (opcional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none resize-none text-sm"
            />
          </div>

          <div className="pt-2 flex gap-3">
            {isEditing && (
              <button type="button" onClick={handleDelete} disabled={deleting || submitting}
                className="p-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
              </button>
            )}
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || deleting}
              className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : isEditing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
