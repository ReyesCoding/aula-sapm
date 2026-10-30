import { useEffect, useState } from 'react';
import { X, Loader2, UserMinus, UserPlus, AlertCircle } from 'lucide-react';
import { getParentChildren, linkChild, unlinkChild, searchUsers, type ChildSummary } from '../../services/user.service';

interface LinkChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: number | null;
  parentName: string;
}

interface StudentOption {
  id: number;
  name: string;
  email: string;
}

export const LinkChildModal = ({ isOpen, onClose, parentId, parentName }: LinkChildModalProps) => {
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!parentId) return;
    setLoading(true);
    setError(null);
    try {
      const [childrenData, studentsData] = await Promise.all([
        getParentChildren(parentId),
        searchUsers('', 'STUDENT'),
      ]);
      setChildren(childrenData);
      setStudents(studentsData);
    } catch {
      setError('No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, parentId]);

  if (!isOpen || !parentId) return null;

  const availableStudents = students.filter((s) => !children.some((c) => c.id === s.id));

  const handleLink = async () => {
    if (!selectedStudentId) return;
    try {
      setSubmitting(true);
      setError(null);
      await linkChild(parentId, Number(selectedStudentId));
      setSelectedStudentId('');
      await load();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'No se pudo vincular.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async (childId: number) => {
    try {
      setSubmitting(true);
      await unlinkChild(parentId, childId);
      await load();
    } catch {
      setError('No se pudo desvincular.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
          Hijos de {parentName}
          <button onClick={onClose} className="opacity-70 hover:opacity-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <>
              {children.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin hijos vinculados todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {children.map((child) => (
                    <li key={child.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{child.name}</p>
                        <p className="text-xs text-gray-500">{child.email}</p>
                      </div>
                      <button
                        onClick={() => handleUnlink(child.id)}
                        disabled={submitting}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Desvincular"
                      >
                        <UserMinus size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Selecciona un estudiante...</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
                <button
                  onClick={handleLink}
                  disabled={!selectedStudentId || submitting}
                  className="bg-primary text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
