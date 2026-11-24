import { useEffect, useState } from 'react';
import { Building2, Plus, Loader2, Users, BookOpen, X, Save, Pencil, Power } from 'lucide-react';
import { getCenters, createCenter, updateCenter, type EducationalCenter } from '../../services/center.service';
import { createUser } from '../../services/user.service';
import { ConfirmDialog } from '../ConfirmDialog';

interface Props {
  onUpdate?: () => void;
}

export const CentersManagement = ({ onUpdate }: Props) => {
  const [centers, setCenters] = useState<EducationalCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', adminName: '', adminEmail: '', adminPassword: '' });

  // Edición de un centro existente (solo nombre — el código es inmutable,
  // igual criterio que Subject.code en el resto de la app).
  const [editingCenter, setEditingCenter] = useState<EducationalCenter | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // "Eliminar" un centro = desactivarlo (no se borra de verdad: tiene
  // profesores/alumnos/materias colgando que perderían su centro). Full
  // CRUD pedido por producto, pero la opción no-destructiva es la correcta
  // acá — ver aviso en el propio ConfirmDialog.
  const [togglingCenter, setTogglingCenter] = useState<EducationalCenter | null>(null);
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const loadCenters = async () => {
    try {
      setLoading(true);
      const data = await getCenters();
      setCenters(data);
    } catch (err) {
      console.error('Error cargando centros:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCenters();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Nombre y código son obligatorios.');
      return;
    }
    if (!formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword) {
      setError('Completa el nombre, email y contraseña del administrador del centro — sin esas credenciales, nadie podría entrar a gestionarlo.');
      return;
    }
    if (formData.adminPassword.length < 6) {
      setError('La contraseña del administrador debe tener al menos 6 caracteres.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      // 1. Crear el centro.
      const center = await createCenter({ name: formData.name.trim(), code: formData.code.trim().toUpperCase() });
      // 2. Crear, en el mismo flujo, la cuenta CENTRO que lo administrará
      //    (pedido explícito: "al momento de crearlos se debería trabajar
      //    más esa parte del correo, contraseña, etc").
      try {
        await createUser({
          name: formData.adminName.trim(),
          email: formData.adminEmail.trim(),
          password: formData.adminPassword,
          role: 'CENTRO',
          educationalCenterId: center.id,
        });
      } catch (userErr: unknown) {
        // El centro ya se creó — no lo deshacemos (podría ya tener datos
        // escritos por otra pestaña), pero avisamos con claridad para que
        // el admin cree la cuenta manualmente desde "Usuarios" si falló.
        const userErrorObj = userErr as { response?: { data?: { message?: string } } };
        setError(
          `El centro "${center.name}" se creó, pero no se pudo crear su cuenta de administrador: ${
            userErrorObj.response?.data?.message || 'error desconocido'
          }. Puedes crearla manualmente desde la pestaña "Usuarios" (rol Centro, mismo centro).`
        );
        await loadCenters();
        if (onUpdate) onUpdate();
        setSubmitting(false);
        return;
      }
      setShowModal(false);
      setFormData({ name: '', code: '', adminName: '', adminEmail: '', adminPassword: '' });
      await loadCenters();
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Error al crear el centro.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (center: EducationalCenter) => {
    setEditingCenter(center);
    setEditName(center.name);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCenter) return;
    if (!editName.trim()) {
      setEditError('El nombre no puede estar vacío.');
      return;
    }
    try {
      setEditSubmitting(true);
      setEditError(null);
      await updateCenter(editingCenter.id, { name: editName.trim() });
      setEditingCenter(null);
      await loadCenters();
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setEditError(errorObj.response?.data?.message || 'Error al actualizar el centro.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmToggleActive = async () => {
    if (!togglingCenter) return;
    try {
      setToggleSubmitting(true);
      setToggleError(null);
      await updateCenter(togglingCenter.id, { isActive: !togglingCenter.isActive });
      setTogglingCenter(null);
      await loadCenters();
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setToggleError(errorObj.response?.data?.message || 'Error al actualizar el estado del centro.');
    } finally {
      setToggleSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="text-primary" /> Gestión de Centros
          </h2>
          <p className="text-sm text-gray-500">Instituciones educativas dadas de alta en la plataforma.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all"
        >
          <Plus size={18} /> Nuevo Centro
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : centers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            Aún no hay centros educativos registrados.
          </div>
        ) : (
          <ul className="space-y-3">
            {centers.map((center) => (
              <li key={center.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{center.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-bold border border-gray-300">{center.code}</span>
                    {!center.isActive && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold border border-red-200">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                    <span className="flex items-center gap-1"><Users size={12} /> {center._count?.users || 0} usuarios</span>
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {center._count?.subjects || 0} materias</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(center)}
                    title="Editar nombre"
                    className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-blue-50 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => { setTogglingCenter(center); setToggleError(null); }}
                    title={center.isActive ? 'Desactivar centro' : 'Reactivar centro'}
                    className={`p-2 rounded-lg transition-colors ${center.isActive ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                  >
                    <Power size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
              Nuevo Centro Educativo
              <button onClick={() => setShowModal(false)} className="opacity-70 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{error}</div>}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Centro</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Colegio San Martín"
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Código Único</label>
                <input
                  required
                  type="text"
                  placeholder="SANMARTIN"
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none uppercase"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Cuenta de administración del centro</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del administrador</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: María López"
                      className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                    <input
                      required
                      type="email"
                      placeholder="centro@sanmartin.edu"
                      className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
                    <input
                      required
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Crear Centro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
              Editar Centro
              <button onClick={() => setEditingCenter(null)} className="opacity-70 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{editError}</div>}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Centro</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">El código ({editingCenter.code}) no se puede cambiar una vez creado el centro.</p>
              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setEditingCenter(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={editSubmitting} className="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {editSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={togglingCenter !== null}
        danger={Boolean(togglingCenter?.isActive)}
        title={togglingCenter?.isActive ? '¿Desactivar este centro?' : '¿Reactivar este centro?'}
        message={
          togglingCenter?.isActive
            ? `Esto deja a "${togglingCenter?.name}" inactivo: sus usuarios no podrán iniciar sesión mientras el centro esté desactivado, pero ningún dato (profesores, estudiantes, materias) se elimina — puedes reactivarlo cuando quieras. Es la forma segura de "borrar" un centro sin perder su información.`
            : `"${togglingCenter?.name}" volverá a estar activo y sus usuarios podrán iniciar sesión normalmente.`
        }
        confirmLabel={togglingCenter?.isActive ? 'Sí, desactivar' : 'Sí, reactivar'}
        loading={toggleSubmitting}
        error={toggleError}
        onConfirm={confirmToggleActive}
        onCancel={() => setTogglingCenter(null)}
      />
    </div>
  );
};
