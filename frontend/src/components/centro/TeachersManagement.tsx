import { useEffect, useState } from 'react';
import { Briefcase, UserPlus, Trash2, Loader2, BookOpen, Plus, Mail, X, Save, AlertCircle, Pencil } from 'lucide-react';
import { getAllUsers, createUser, updateUser, deleteUser, type User } from '../../services/user.service';
import { getSubjects, updateSubject, deleteSubject, type Subject } from '../../services/subject.service';
import { CreateSubjectModal } from '../CreateSubjectModal';
import { ConfirmDialog } from '../ConfirmDialog';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

/**
 * Panel de "Gestión de Profesores" para el rol CENTRO.
 *
 * v3.0 (nov. 2026): antes Centro entraba a la misma pantalla que un
 * profesor/estudiante ("Mis Materias", con botón de "Nueva Materia" suelto,
 * como si Centro impartiera clases) — Bryan señaló, con razón, que el
 * trabajo de Centro es administrar a SU PERSONAL DOCENTE (altas, bajas,
 * qué materias imparte cada quien), no operar materias directamente. Este
 * componente reemplaza esa vista para Centro: una lista de profesores,
 * cada uno con las materias que tiene asignadas, con acciones para
 * crear/eliminar profesores y crear/reasignar/eliminar materias.
 *
 * El backend ya refuerza este alcance del lado del servidor (ver
 * users.controller.ts y subject.controller.ts, v3.0): aunque esta UI
 * fallara o alguien llamara la API directo, un Centro nunca puede crear
 * cuentas que no sean TEACHER, ni tocar profesores/materias de otro centro.
 */
export const TeachersManagement = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const [showCreateSubject, setShowCreateSubject] = useState(false);

  const [confirmDeleteTeacher, setConfirmDeleteTeacher] = useState<User | null>(null);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<Subject | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Edición de profesor (nombre/email/contraseña) — antes solo se podía
  // crear y borrar, nunca corregir un dato o resetear la contraseña.
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [usersData, subjectsData] = await Promise.all([getAllUsers(), getSubjects()]);
      // El backend ya filtra a solo-profesores-de-mi-centro cuando quien
      // pregunta es CENTRO, pero filtramos de nuevo aquí por si este mismo
      // componente se reutiliza alguna vez desde un contexto más amplio.
      setTeachers(usersData.filter((u) => u.role === 'TEACHER'));
      setSubjects(subjectsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      setSubmitting(true);
      await createUser({ name: form.name, email: form.email, password: form.password, role: 'TEACHER' });
      setShowCreateTeacher(false);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setCreateError(errorObj.response?.data?.message || 'Error al crear el profesor. Verifica que el email no exista.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmHandleDeleteTeacher = async () => {
    if (!confirmDeleteTeacher) return;
    setConfirmSubmitting(true);
    setConfirmError(null);
    try {
      await deleteUser(confirmDeleteTeacher.id);
      setConfirmDeleteTeacher(null);
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setConfirmError(errorObj.response?.data?.message || 'No se pudo eliminar al profesor.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const confirmHandleDeleteSubject = async () => {
    if (!confirmDeleteSubject) return;
    setConfirmSubmitting(true);
    setConfirmError(null);
    try {
      await deleteSubject(confirmDeleteSubject.id);
      setConfirmDeleteSubject(null);
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setConfirmError(errorObj.response?.data?.message || 'No se pudo eliminar la materia.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleReassign = async (subjectId: number, newTeacherId: number) => {
    setListError(null);
    try {
      await updateSubject(subjectId, { teacherId: newTeacherId });
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setListError(errorObj.response?.data?.message || 'No se pudo reasignar la materia.');
    }
  };

  const subjectsForTeacher = (teacherId: number) => subjects.filter((s) => (s.teacher?.id ?? s.teacherId) === teacherId);

  const openEditTeacher = (teacher: User) => {
    setEditingTeacher(teacher);
    setEditForm({ name: teacher.name, email: teacher.email, password: '' });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Nombre y email son obligatorios.');
      return;
    }
    try {
      setEditSubmitting(true);
      setEditError(null);
      await updateUser(editingTeacher.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        password: editForm.password || undefined,
      });
      setEditingTeacher(null);
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setEditError(errorObj.response?.data?.message || 'No se pudo actualizar al profesor.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50 rounded-t-lg">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Briefcase className="text-primary" /> Gestión de Profesores
          </h2>
          <p className="text-sm text-gray-500">
            Da de alta/baja a tu profesorado y asigna qué materias imparte cada uno.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateSubject(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm transition-all"
          >
            <Plus size={16} /> Nueva Materia
          </button>
          <button
            onClick={() => setShowCreateTeacher(true)}
            className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm transition-all"
          >
            <UserPlus size={16} /> Nuevo Profesor
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-4">
        {listError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100 flex items-center gap-2">
            <AlertCircle size={16} /> {listError}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Briefcase className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            Aún no tienes profesores registrados en tu centro.
          </div>
        ) : (
          <ul className="space-y-4">
            {teachers.map((teacher) => {
              const theirSubjects = subjectsForTeacher(teacher.id);
              return (
                <li key={teacher.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{teacher.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12} /> {teacher.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditTeacher(teacher)}
                        className="text-gray-400 hover:text-primary transition-colors p-2 hover:bg-blue-50 rounded-full"
                        title="Editar profesor"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => { setConfirmError(null); setConfirmDeleteTeacher(teacher); }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                        title="Eliminar profesor"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                      <BookOpen size={12} /> Materias asignadas ({theirSubjects.length})
                    </p>
                    {theirSubjects.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Sin materias asignadas todavía.</p>
                    ) : (
                      <div className="space-y-2">
                        {theirSubjects.map((subject) => (
                          <div key={subject.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-sm text-gray-700 truncate">{subject.name}</span>
                              {subject.code && (
                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                                  {subject.code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={teacher.id}
                                onChange={(e) => handleReassign(subject.id, Number(e.target.value))}
                                title="Reasignar a otro profesor"
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-primary outline-none"
                              >
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => { setConfirmError(null); setConfirmDeleteSubject(subject); }}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-full"
                                title="Eliminar materia"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal: Crear Profesor */}
      {showCreateTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
              Nuevo Profesor
              <button onClick={() => setShowCreateTeacher(false)} className="opacity-70 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{createError}</div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                <input type="text" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Prof. Ana Gómez" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input type="email" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="profesor@aula.com" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
                <input type="password" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="******" />
              </div>
              <button disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded mt-2 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar Profesor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Profesor */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
              Editar Profesor
              <button onClick={() => setEditingTeacher(null)} className="opacity-70 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                <input type="text" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input type="email" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nueva Contraseña (opcional)</label>
                <input type="password" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Déjalo vacío para no cambiarla" />
              </div>
              <button disabled={editSubmitting} className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-3 rounded mt-2 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {editSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      <CreateSubjectModal isOpen={showCreateSubject} onClose={() => setShowCreateSubject(false)} onCreated={load} />

      <ConfirmDialog
        isOpen={confirmDeleteTeacher != null}
        title="¿Eliminar profesor?"
        message={`Esta acción no se puede deshacer${confirmDeleteTeacher ? `: se eliminará la cuenta de ${confirmDeleteTeacher.name}` : ''}. Si tiene materias asignadas, reasígnalas primero.`}
        loading={confirmSubmitting}
        error={confirmError}
        onConfirm={confirmHandleDeleteTeacher}
        onCancel={() => { setConfirmDeleteTeacher(null); setConfirmError(null); }}
      />
      <ConfirmDialog
        isOpen={confirmDeleteSubject != null}
        title="¿Eliminar materia?"
        message={`Esta acción no se puede deshacer${confirmDeleteSubject ? `: se eliminará "${confirmDeleteSubject.name}"` : ''}. Si tiene tareas, exámenes o inscripciones, no se podrá eliminar.`}
        loading={confirmSubmitting}
        error={confirmError}
        onConfirm={confirmHandleDeleteSubject}
        onCancel={() => { setConfirmDeleteSubject(null); setConfirmError(null); }}
      />
    </div>
  );
};
