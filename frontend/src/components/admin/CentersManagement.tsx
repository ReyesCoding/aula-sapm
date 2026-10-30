import { useEffect, useState } from 'react';
import { Building2, Plus, Loader2, Users, BookOpen, X, Save } from 'lucide-react';
import { getCenters, createCenter, type EducationalCenter } from '../../services/center.service';

interface Props {
  onUpdate?: () => void;
}

export const CentersManagement = ({ onUpdate }: Props) => {
  const [centers, setCenters] = useState<EducationalCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '' });

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
    try {
      setSubmitting(true);
      setError(null);
      await createCenter({ name: formData.name.trim(), code: formData.code.trim().toUpperCase() });
      setShowModal(false);
      setFormData({ name: '', code: '' });
      await loadCenters();
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Error al crear el centro.');
    } finally {
      setSubmitting(false);
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
    </div>
  );
};
