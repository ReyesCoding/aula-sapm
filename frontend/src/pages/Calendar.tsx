import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Loader2, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEvents, type CalendarEvent } from '../services/calendar.service';
import { getSubjects } from '../services/subject.service';
import { EventModal } from '../components/EventModal';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const scopeStyles: Record<string, { dot: string; chip: string }> = {
  PERSONAL: { dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-700' },
  CENTER: { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700' },
  SUBJECT: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
};

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Devuelve todas las claves yyyy-mm-dd que un evento toca (puede abarcar varios días). */
function eventDateKeys(event: CalendarEvent): string[] {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let guard = 0;
  while (cursor <= last && guard < 60) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return keys;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySubjectIds, setMySubjectIds] = useState<number[]>([]);

  const [selectedDay, setSelectedDay] = useState<string>(dateKey(today));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Rango visible del grid: incluye días de padding del mes anterior/siguiente.
  const gridStart = useMemo(() => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [viewDate]);

  const gridDays = useMemo(() => {
    const days: Date[] = [];
    const cursor = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [gridStart]);

  const gridEnd = gridDays[gridDays.length - 1];

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEvents(gridStart.toISOString(), gridEnd.toISOString());
      setEvents(data);
    } catch (error) {
      console.error('Error cargando eventos del calendario:', error);
    } finally {
      setLoading(false);
    }
  }, [gridStart, gridEnd]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (user?.role === 'TEACHER') {
      getSubjects()
        .then((subjects) => setMySubjectIds(subjects.filter((s) => s.teacher?.id === user.id).map((s) => s.id)))
        .catch(() => setMySubjectIds([]));
    }
  }, [user]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      for (const key of eventDateKeys(ev)) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
    }
    return map;
  }, [events]);

  const canMutate = useCallback(
    (ev: CalendarEvent): boolean => {
      if (!user) return false;
      if (ev.scope === 'PERSONAL') return ev.ownerId === user.id;
      if (ev.scope === 'CENTER') {
        if (user.role === 'ADMIN') return true;
        if (user.role === 'CENTRO') return ev.educationalCenterId !== null;
        return false;
      }
      // SUBJECT
      if (user.role === 'ADMIN' || user.role === 'CENTRO') return true;
      if (user.role === 'TEACHER') return ev.subjectId != null && mySubjectIds.includes(ev.subjectId);
      return false;
    },
    [user, mySubjectIds]
  );

  const goToMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const goToToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(dateKey(today));
  };

  const openNewEvent = (dayKey?: string) => {
    setEditingEvent(null);
    setSelectedDay(dayKey || selectedDay);
    setIsModalOpen(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    if (!canMutate(ev)) return;
    setEditingEvent(ev);
    setIsModalOpen(true);
  };

  const selectedDayEvents = (eventsByDay.get(selectedDay) || [])
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const formatTime = (iso: string, allDay: boolean) =>
    allDay ? 'Todo el día' : new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-violet-600 mb-6 transition">
          <ArrowLeft size={20} className="mr-2" /> Volver al Dashboard
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* GRID MENSUAL */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => goToMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition"><ChevronLeft size={18} /></button>
                <h2 className="font-bold text-lg text-gray-800 w-44 text-center">
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </h2>
                <button onClick={() => goToMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 transition"><ChevronRight size={18} /></button>
                <button onClick={goToToday} className="text-xs font-bold text-violet-600 hover:underline ml-2">Hoy</button>
              </div>
              <button
                onClick={() => openNewEvent()}
                className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-violet-700 transition"
              >
                <Plus size={14} /> Nuevo Evento
              </button>
            </div>

            {loading ? (
              <div className="text-center py-16"><Loader2 className="animate-spin text-violet-600 mx-auto" /></div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="text-center text-[11px] font-bold text-gray-400 py-1 uppercase">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {gridDays.map((day) => {
                    const key = dateKey(day);
                    const dayEvents = (eventsByDay.get(key) || []).sort(
                      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
                    );
                    const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                    const isToday = key === dateKey(today);
                    const isSelected = key === selectedDay;

                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDay(key)}
                        className={`min-h-[84px] text-left p-1.5 rounded-lg border transition flex flex-col gap-1 ${
                          isSelected ? 'border-violet-400 bg-violet-50' : 'border-gray-100 hover:bg-gray-50'
                        } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                      >
                        <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-violet-600 text-white' : 'text-gray-600'}`}>
                          {day.getDate()}
                        </span>
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {dayEvents.slice(0, 2).map((ev) => (
                            <span key={ev.id} className={`text-[9px] font-bold px-1 py-0.5 rounded truncate ${scopeStyles[ev.scope].chip}`}>
                              {ev.title}
                            </span>
                          ))}
                          {dayEvents.length > 2 && (
                            <span className="text-[9px] text-gray-400 font-bold px-1">+{dayEvents.length - 2} más</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
              {Object.entries(scopeStyles).map(([scope, style]) => (
                <div key={scope} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  {scope === 'PERSONAL' ? 'Personal' : scope === 'CENTER' ? 'Centro' : 'Materia'}
                </div>
              ))}
            </div>
          </div>

          {/* PANEL DEL DÍA SELECCIONADO */}
          <div className="w-full lg:w-80 bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm">
                {new Date(selectedDay + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button
                onClick={() => openNewEvent(selectedDay)}
                className="text-violet-600 hover:bg-violet-50 p-1.5 rounded-lg transition"
                title="Nuevo evento este día"
              >
                <Plus size={16} />
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin eventos este día.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto">
                {selectedDayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => openEditEvent(ev)}
                    className={`border border-gray-100 rounded-lg p-3 ${canMutate(ev) ? 'cursor-pointer hover:bg-gray-50' : ''} transition`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${scopeStyles[ev.scope].dot}`} />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">{ev.title}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {formatTime(ev.startsAt, ev.allDay)}
                        </p>
                        {ev.location && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={11} /> {ev.location}
                          </p>
                        )}
                        {ev.subject && (
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{ev.subject.name}</p>
                        )}
                        {ev.description && <p className="text-xs text-gray-500 mt-1">{ev.description}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEvents}
        defaultDate={selectedDay}
        event={editingEvent}
      />
    </div>
  );
}
