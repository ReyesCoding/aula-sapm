import { useEffect, useState } from 'react';
import { GraduationCap, UserPlus, Loader2, Mail, X, Save, AlertCircle, Users, Plus } from 'lucide-react';
import {
  getAllUsers,
  getStudentParents,
  createStudentWithParent,
  addParentToStudent,
  type User,
  type ChildSummary,
} from '../../services/user.service';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

type ParentMode = 'new' | 'existing' | 'none';

/**
 * Panel de "Gestión de Estudiantes" para el rol CENTRO (v3.1).
 *
 * Pedido explícito de producto: "el centro es quien crea los estudiantes
 * que se matriculan al mismo, y en el mismo registro donde van sus
 * credenciales se le asigna el padre al estudiante junto con sus
 * credenciales también" — y que esta gestión esté visualmente separada de
 * Profesores/Padres, no todo mezclado. Este componente es ese flujo:
 * matricula un estudiante y, en el mismo modal, crea o vincula a su
 * padre/madre (máximo 2 por estudiante — ver users.controller.ts).
 */
export const StudentsManagement = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [parentsByStudent, setParentsByStudent] = useState<Record<number, ChildSummary[]>>({});
  const [allParents, setAllParents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    studentName: '', studentEmail: '', studentPassword: '',
    parentMode: 'new' as ParentMode,
    parentName: '', parentEmail: '', parentPassword: '',
    existingParentId: '' as number | '',
  });

  // Agregar un 2do (o 1er) padre/madre a un estudiante ya existente.
  const [addParentFor, setAddParentFor] = useState<User | null>(null);
  const [addParentForm, setAddParentForm] = useState({
    parentMode: 'new' as 'new' | 'existing',
    parentName: '', parentEmail: '', parentPassword: '',
    existingParentId: '' as number | '',
  });
  const [addParentSubmitting, setAddParentSubmitting] = useState(false);
  const [addParentError, setAddParentError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [studentsData, parentsData] = await Promise.all([
        getAllUsers('STUDENT'),
        getAllUsers('PARENT'),
      ]);
      setStudents(studentsData);
      setAllParents(parentsData);
      const entries = await Promise.all(
        studentsData.map(async (s) => [s.id, await getStudentParents(s.id)] as const)
      );
      setParentsByStudent(Object.fromEntries(entries));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetCreateForm = () => {
    setForm({
      studentName: '', studentEmail: '', studentPassword: '',
      parentMode: 'new', parentName: '', parentEmail: '', parentPassword: '',
      existingParentId: '',
    });
    setCreateError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!form.studentName.trim() || !form.studentEmail.trim() || !form.studentPassword) {
      setCreateError('Nombre, email y contraseña del estudiante son obligatorios.');
      return;
    }
    if (form.parentMode === 'new' && (!form.parentName.trim() || !form.parentEmail.trim() || !form.parentPassword)) {
      setCreateError('Completa nombre, email y contraseña del padre/madre, o cambia a "Padre/madre existente" / "Sin padre por ahora".');
      return;
    }
    if (form.parentMode === 'existing' && !form.existingParentId) {
      setCreateError('Selecciona el padre/madre existente.');
      return;
    }
    try {
      setSubmitting(true);
      await createStudentWithParent({
        studentName: form.studentName.trim(),
        studentEmail: form.studentEmail.trim(),
        studentPassword: form.studentPassword,
        parentMode: form.parentMode,
        parentName: form.parentName.trim() || undefined,
        parentEmail: form.parentEmail.trim() || undefined,
        parentPassword: form.parentPassword || undefined,
        existingParentId: form.existingParentId ? Number(form.existingParentId) : undefined,
      });
      setShowCreate(false);
      resetCreateForm();
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setCreateError(errorObj.response?.data?.message || 'Error al matricular al estudiante.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAddParent = (student: User) => {
    setAddParentFor(student);
    setAddParentForm({ parentMode: 'new', parentName: '', parentEmail: '', parentPassword: '', existingParentId: '' });
    setAddParentError(null);
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addParentFor) return;
    setAddParentError(null);
    if (addParentForm.parentMode === 'new' && (!addParentForm.parentName.trim() || !addParentForm.parentEmail.trim() || !addParentForm.parentPassword)) {
      setAddParentError('Completa nombre, email y contraseña del padre/madre.');
      return;
    }
    if (addParentForm.parentMode === 'existing' && !addParentForm.existingParentId) {
      setAddParentError('Selecciona el padre/madre existente.');
      return;
    }
    try {
      setAddParentSubmitting(true);
      await addParentToStudent(addParentFor.id, {
        parentMode: addParentForm.parentMode,
        parentName: addParentForm.parentName.trim() || undefined,
        parentEmail: addParentForm.parentEmail.trim() || undefined,
        parentPassword: addParentForm.parentPassword || undefined,
        existingParentId: addParentForm.existingParentId ? Number(addParentForm.existingParentId) : undefined,
      });
      setAddParentFor(null);
      load();
    } catch (error: unknown) {
      const errorObj = error as ApiError;
      setAddParentError(errorObj.response?.data?.message || 'No se pudo vincular al padre/madre.');
    } finally {
      setAddParentSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50 rounded-t-lg">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-primary" /> Gestión de Estudiantes
          </h2>
          <p className="text-sm text-gray-500">Matricula estudiantes en tu centro y asígnales su padre/madre.</p>
        </div>
        <button
          onClick={() => { resetCreateForm(); setShowCreate(true); }}
          className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm transition-all shrink-0"
        >
          <UserPlus size={16} /> Nuevo Estudiante
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <GraduationCap className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            Aún no tienes estudiantes matriculados en tu centro.
          </div>
        ) : (
          <ul className="space-y-3">
            {students.map((student) => {
              const parents = parentsByStudent[student.id] ?? [];
              return (
                <li key={student.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{student.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12} /> {student.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                      <Users size={12} /> Padre/Madre ({parents.length}/2)
                    </p>
                    {parents.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Sin padre/madre vinculado.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {parents.map((p) => (
                          <span key={p.id} className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {parents.length < 2 && (
                      <button
                        onClick={() => openAddParent(student)}
                        className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Agregar padre/madre
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal: Nuevo Estudiante (+ Padre/Madre) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center shrink-0">
              Nuevo Estudiante
              <button onClick={() => setShowCreate(false)} className="opacity-70 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto">
              {createError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" /> {createError}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Datos del estudiante</p>
                <div className="space-y-3">
                  <input type="text" required placeholder="Nombre completo" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
                  <input type="email" required placeholder="Email" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={form.studentEmail} onChange={(e) => setForm({ ...form, studentEmail: e.target.value })} />
                  <input type="password" required placeholder="Contraseña" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={form.studentPassword} onChange={(e) => setForm({ ...form, studentPassword: e.target.value })} />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Padre / Madre</p>
                <div className="flex gap-2 mb-3">
                  {(['new', 'existing', 'none'] as ParentMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, parentMode: m })}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-colors ${form.parentMode === m ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {m === 'new' ? 'Nuevo' : m === 'existing' ? 'Ya existente' : 'Sin padre por ahora'}
                    </button>
                  ))}
                </div>

                {form.parentMode === 'new' && (
                  <div className="space-y-3">
                    <input type="text" placeholder="Nombre del padre/madre" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                      value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
                    <input type="email" placeholder="Email del padre/madre" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                      value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
                    <input type="password" placeholder="Contraseña del padre/madre" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                      value={form.parentPassword} onChange={(e) => setForm({ ...form, parentPassword: e.target.value })} />
                  </div>
                )}
                {form.parentMode === 'existing' && (
                  <select
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={form.existingParentId}
                    onChange={(e) => setForm({ ...form, existingParentId: e.target.value ? Number(e.target.value) : '' })}
                  >
                    <option value="">Selecciona un padre/madre...</option>
                    {allParents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                  </select>
                )}
                {form.parentMode === 'none' && (
                  <p className="text-xs text-gray-400 italic">Podrás vincular un padre/madre más adelante desde la ficha del estudiante.</p>
                )}
              </div>

              <button disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded mt-2 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Matricular Estudiante
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar padre/madre a un estudiante existente */}
      {addParentFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
              Vincular Padre/Madre a {addParentFor.name}
              <button onClick={() => setAddParentFor(null)} className="opacity-70 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddParent} className="p-6 space-y-4">
              {addParentError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{addParentError}</div>
              )}
              <div className="flex gap-2">
                {(['new', 'existing'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAddParentForm({ ...addParentForm, parentMode: m })}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-colors ${addParentForm.parentMode === m ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {m === 'new' ? 'Cuenta nueva' : 'Ya existente'}
                  </button>
                ))}
              </div>
              {addParentForm.parentMode === 'new' ? (
                <div className="space-y-3">
                  <input type="text" placeholder="Nombre" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={addParentForm.parentName} onChange={(e) => setAddParentForm({ ...addParentForm, parentName: e.target.value })} />
                  <input type="email" placeholder="Email" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={addParentForm.parentEmail} onChange={(e) => setAddParentForm({ ...addParentForm, parentEmail: e.target.value })} />
                  <input type="password" placeholder="Contraseña" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={addParentForm.parentPassword} onChange={(e) => setAddParentForm({ ...addParentForm, parentPassword: e.target.value })} />
                </div>
              ) : (
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={addParentForm.existingParentId}
                  onChange={(e) => setAddParentForm({ ...addParentForm, existingParentId: e.target.value ? Number(e.target.value) : '' })}
                >
                  <option value="">Selecciona un padre/madre...</option>
                  {allParents
                    .filter((p) => !(parentsByStudent[addParentFor.id] ?? []).some((linked) => linked.id === p.id))
                    .map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                </select>
              )}
              <button disabled={addParentSubmitting} className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-3 rounded mt-2 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {addParentSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Vincular
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
