import { useEffect, useState, useCallback } from 'react';
import { X, Trash2, Edit, Save, FileText, User, AlertTriangle, Loader2, MessageSquare } from 'lucide-react';
import api from '../services/api';
import { deleteAssignment } from '../services/assignment.service';

interface TaskManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: number | null;
  onTaskUpdated: () => void;
  onEditRequested: (taskData: AssignmentDetails) => void;
}

// 👇 Agregamos submissionComment a la interfaz
interface Submission {
  id: number;
  student: { name: string; email: string };
  status: string;
  grade: number | null;
  submissionUrl: string | null;
  submissionComment: string | null; // ✅ Nuevo campo
  submittedAt: string;
  feedback: string | null;
}

interface AssignmentDetails {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  subjectId: number;
  attachmentUrl?: string;
}

export const TaskManagementModal = ({ isOpen, onClose, assignmentId, onTaskUpdated, onEditRequested }: TaskManagementModalProps) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [details, setDetails] = useState<AssignmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Record<number, number>>({});
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const resDetails = await api.get(`/assignments/${assignmentId}`); 
      setDetails(resDetails.data);

      const resSubs = await api.get(`/assignments/${assignmentId}/submissions`);
      setSubmissions(resSubs.data);
      
      // Inicializar notas locales para edición
      const initialGrades: Record<number, number> = {};
      resSubs.data.forEach((sub: Submission) => {
          if (sub.grade !== null) initialGrades[sub.id] = sub.grade;
      });
      setGrades(initialGrades);

    } catch (error) {
      console.error("Error cargando tarea", error);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (isOpen && assignmentId) {
      loadDetails();
      setShowDeleteConfirm(false);
    }
  }, [isOpen, assignmentId, loadDetails]);

  const handleEditClick = () => {
      if (details) {
          onEditRequested(details);
          onClose();
      }
  };

  const confirmDelete = async () => {
    if (!assignmentId) return;
    setIsDeleting(true);
    try {
        await deleteAssignment(assignmentId);
        onTaskUpdated();
        onClose();
    } catch (error) {
        console.error(error);
        alert("Error al eliminar");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleGrade = async (submissionId: number) => {
    const grade = grades[submissionId];
    if (grade === undefined) return;

    try {
        await api.patch(`/assignments/${submissionId}/grade`, { grade, feedback: "Calificado." });
        alert("Calificado correctamente");
        loadDetails();
    } catch (error) {
        console.error(error);
        alert("Error guardando nota");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className={`bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col max-h-[90vh] transition-opacity ${showDeleteConfirm ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{details?.title || 'Cargando...'}</h2>
            <p className="text-sm text-gray-500">Gestión de Tarea</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleEditClick} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Editar Tarea">
                <Edit size={20} />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition" title="Eliminar Tarea">
                <Trash2 size={20} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700">
                <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
            {loading ? (
                <div className="text-center py-10 flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-blue-600" />
                    <span className="text-gray-500">Cargando datos...</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Detalles Extra (Archivo del profesor) */}
                    {details?.attachmentUrl && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-3 shadow-sm">
                            <div className="bg-white p-2 rounded text-blue-600">
                                <FileText size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-900">Material de Referencia</p>
                                <a href={`/uploads/${details.attachmentUrl}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                    Ver archivo original
                                </a>
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b border-gray-200">
                            <User size={18}/> Entregas de Estudiantes ({submissions.length})
                        </h3>
                        
                        {submissions.length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-400 italic">Nadie ha entregado esta tarea aún.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {submissions.map(sub => (
                                    <div key={sub.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                                        
                                        {/* Fila Superior: Info + Acciones */}
                                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                            
                                            {/* Info Estudiante */}
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                                                    {sub.student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{sub.student.name}</p>
                                                    <p className="text-xs text-gray-500">{new Date(sub.submittedAt).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            {/* Acciones: Ver Archivo + Calificar */}
                                            <div className="flex items-center gap-4 w-full md:w-auto">
                                                {sub.submissionUrl ? (
                                                    <a href={`/uploads/${sub.submissionUrl}`} target="_blank" rel="noreferrer" 
                                                       className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors border border-gray-200">
                                                        <FileText size={16}/> Ver Trabajo
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-gray-400 italic px-2">Sin archivo</span>
                                                )}

                                                <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        placeholder={sub.grade?.toString() || "0"}
                                                        className="w-16 border border-gray-300 rounded-lg p-2 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                        onChange={(e) => setGrades({...grades, [sub.id]: Number(e.target.value)})}
                                                        defaultValue={sub.grade ?? ""}
                                                    />
                                                    <span className="text-gray-400 text-sm font-medium">/ 100</span>
                                                    <button 
                                                        onClick={() => handleGrade(sub.id)}
                                                        className="ml-2 bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition shadow-sm" title="Guardar Nota">
                                                        <Save size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 👇 SECCIÓN DE COMENTARIOS (NUEVO) */}
                                        {sub.submissionComment && (
                                            <div className="mt-4 pt-3 border-t border-gray-100">
                                                <div className="flex gap-2">
                                                    <MessageSquare size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Comentario del estudiante:</p>
                                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                                            "{sub.submissionComment}"
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Modal de Confirmación */}
      {showDeleteConfirm && (
          <div className="absolute bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 border border-red-100 z-50">
              <div className="flex flex-col items-center text-center gap-4">
                  <div className="bg-red-100 p-3 rounded-full text-red-600">
                      <AlertTriangle size={32} />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-gray-900">¿Eliminar Tarea?</h3>
                      <p className="text-sm text-gray-500 mt-1">Esta acción es irreversible y borrará todas las entregas asociadas.</p>
                  </div>
                  <div className="flex gap-3 w-full mt-2">
                      <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition">
                          Cancelar
                      </button>
                      <button onClick={confirmDelete} className="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition shadow flex justify-center items-center gap-2">
                          {isDeleting ? <Loader2 className="animate-spin" size={16}/> : 'Sí, Eliminar'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};