import { useState, useEffect } from 'react';
import { 
  X, Loader2, Trash2, Download, 
  CheckCircle, GraduationCap, Clock, FileText, ExternalLink, Pencil, Save, AlertTriangle 
} from 'lucide-react';
import { deleteAssignment, gradeAssignment, updateAssignment } from '../services/assignment.service';
import { useAuth } from '../context/AuthContext';
import type { Assignment } from '../services/assignment.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: Assignment | null;
  onUpdate: () => void;
}

export const TaskDetailModal = ({ isOpen, onClose, task, onUpdate }: Props) => {
  const { user } = useAuth();

  // Estados Generales
  const [loading, setLoading] = useState(false);
  
  // (Nota: Eliminamos 'file' y 'comment' de aquí porque este modal YA NO entrega tareas)
  // Solo mantenemos 'file' para cuando el PROFESOR edita y cambia el adjunto.
  const [teacherFile, setTeacherFile] = useState<File | null>(null);

  // Estados Profesor (Calificación)
  const [grade, setGrade] = useState<number | ''>('');
  const [feedback, setFeedback] = useState('');

  // Estados Profesor (EDICIÓN)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    dueDate: ''
  });

  // Cargar datos al abrir modal
  useEffect(() => {
    if (task) {
        setIsEditing(false);
        setTeacherFile(null);
        setEditForm({
            title: task.title,
            description: task.description,
            dueDate: new Date(task.dueDate).toISOString().split('T')[0]
        });
        setGrade('');
        setFeedback('');
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  // --- UTILIDADES ---
  const isImage = (filename?: string | null) => {
    if (!filename) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  };
  
  // Cálculo de vencimiento para mostrar avisos
  const isExpired = new Date() > new Date(task.dueDate);

  // Bloque 7 (deployment): ruta relativa en vez de "http://localhost:3001" fijo (ver services/api.ts).
  const teacherAttachmentUrl = task.attachmentUrl ? `/uploads/${task.attachmentUrl}` : null;
  const studentSubmissionUrl = task.submissionUrl ? `/uploads/${task.submissionUrl}` : null;

  // --- ACCIONES ---

  // 1. EDITAR TAREA (Teacher)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        await updateAssignment(task.id, editForm, teacherFile);
        setIsEditing(false);
        onUpdate(); 
    } catch (error) {
        console.error(error);
        alert('Error al actualizar tarea');
    } finally {
        setLoading(false);
    }
  };

  // 2. CALIFICAR (Teacher)
  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grade === '' || grade < 0 || grade > 100) return alert('Nota inválida');
    setLoading(true);
    try {
      await gradeAssignment(task.id, Number(grade), feedback);
      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error al calificar.');
    } finally {
      setLoading(false);
    }
  };

  // 3. ELIMINAR (Teacher)
  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
    setLoading(true);
    try {
      await deleteAssignment(task.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* HEADER */}
        <div className={`px-6 py-4 flex justify-between items-center text-white ${
            task.status === 'GRADED' ? 'bg-green-600' :
            task.status === 'SUBMITTED' ? 'bg-blue-600' : 
            'bg-gray-800'
        }`}>
          <div className="flex items-center gap-3 w-full">
             {task.status === 'PENDING' ? <Clock size={24}/> : <CheckCircle size={24}/>}
             
             <div className="flex-1">
                {isEditing ? (
                    <h3 className="font-bold text-lg text-yellow-300 flex items-center gap-2">
                        <Pencil size={18}/> Editando Tarea...
                    </h3>
                ) : (
                    <>
                        <h3 className="font-bold text-lg leading-tight truncate pr-4">{task.title}</h3>
                        <span className="text-xs opacity-90 flex items-center gap-1">
                            <GraduationCap size={12}/> {task.subject.name}
                        </span>
                    </>
                )}
             </div>

             {/* BOTONES DE CONTROL (SOLO TEACHER) */}
             {user?.role === 'TEACHER' && !isEditing && (
                 <button 
                    onClick={() => setIsEditing(true)} 
                    className="bg-white/10 hover:bg-white/20 p-2 rounded text-xs font-bold flex items-center gap-1 mr-2 transition-colors"
                    title="Editar Tarea"
                 >
                    <Pencil size={14} /> Editar
                 </button>
             )}
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors"><X size={24}/></button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* ================= MODE: EDICIÓN ================= */}
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
                {/* Campos de edición */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Título</label>
                    <input 
                        type="text" required 
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-primary outline-none"
                        value={editForm.title}
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
                    <textarea 
                        rows={5}
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-primary outline-none"
                        value={editForm.description}
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Fecha de Entrega</label>
                    <input 
                        type="date" required 
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-primary outline-none"
                        value={editForm.dueDate}
                        onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Reemplazar Archivo (Opcional)</label>
                    <div className="border border-gray-300 rounded p-2 flex items-center gap-2">
                        <input type="file" onChange={e => setTeacherFile(e.target.files?.[0] || null)} />
                    </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                    <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                    <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-primary rounded hover:bg-blue-700 flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Guardar Cambios
                    </button>
                </div>
            </form>
          ) : (
            
            /* ================= MODE: VISTA NORMAL ================= */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* IZQUIERDA */}
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <FileText size={14}/> Instrucciones
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {task.description || 'Sin descripción adicional.'}
                        </div>
                    </div>

                    {/* ARCHIVO ADJUNTO DEL PROFESOR */}
                    {task.attachmentUrl && (
                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Material Adjunto</h4>
                            {isImage(task.attachmentUrl) ? (
                                <a href={teacherAttachmentUrl!} target="_blank" rel="noopener noreferrer" className="group block relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-all">
                                    <img src={teacherAttachmentUrl!} alt="Material" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all"/>
                                    <div className="absolute inset-0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <div className="bg-white/90 text-gray-800 text-xs font-bold px-3 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm flex items-center gap-2">
                                            <ExternalLink size={14} /> Ver / Descargar
                                        </div>
                                    </div>
                                </a>
                            ) : (
                                <a href={teacherAttachmentUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Download className="text-blue-600" size={20}/> 
                                        <span className="text-sm font-medium text-blue-900 truncate">{task.attachmentUrl}</span>
                                    </div>
                                    <span className="text-xs text-blue-500 font-bold">Descargar</span>
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* DERECHA (ESTADO) */}
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Fecha de Entrega</p>
                        <p className={`font-bold text-lg ${isExpired && task.status === 'PENDING' ? 'text-red-600' : 'text-gray-800'}`}>
                            {new Date(task.dueDate).toLocaleDateString()}
                            {isExpired && task.status === 'PENDING' && <span className="text-xs block text-red-500 font-medium">¡Vencida!</span>}
                        </p>
                    </div>
                    
                    <div className={`p-4 rounded-lg border ${
                        task.status === 'GRADED' ? 'bg-green-50 border-green-200' :
                        task.status === 'SUBMITTED' ? 'bg-blue-50 border-blue-200' :
                        'bg-yellow-50 border-yellow-200'
                        }`}>
                        <p className="text-xs opacity-70 mb-1 uppercase font-bold">Estado</p>
                        <p className={`font-bold text-lg ${
                            task.status === 'GRADED' ? 'text-green-700' :
                            task.status === 'SUBMITTED' ? 'text-blue-700' :
                            'text-yellow-700'
                        }`}>
                            {task.status === 'GRADED' ? 'Calificada' : 
                            task.status === 'SUBMITTED' ? 'Entregada' : 'Pendiente'}
                        </p>
                        {task.status === 'GRADED' && (
                            <div className="mt-2 pt-2 border-t border-green-200">
                                <span className="block text-3xl font-black text-green-800">{task.grade}/100</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          )}

          {/* ================= PIE DE PÁGINA (ZONA ENTREGA / CALIFICAR / BORRAR) ================= */}
          {!isEditing && (
            <div className="border-t pt-6 mt-2">
                
                {/* 1. VISUALIZAR ENTREGA (Si ya entregó) */}
                {(task.status === 'SUBMITTED' || task.status === 'GRADED') && (
                    <div className="mb-6">
                       <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                         <CheckCircle size={18} className="text-green-500" /> Archivo Entregado
                       </h3>
                       <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                          <span className="text-sm text-gray-600 truncate">{task.submissionUrl || 'Archivo entregado'}</span>
                          {studentSubmissionUrl && (
                             <a href={studentSubmissionUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-bold hover:underline">Ver Archivo</a>
                          )}
                       </div>
                       {task.submissionComment && <div className="mt-2 text-sm text-gray-500 italic px-4">"{task.submissionComment}"</div>}
                       {task.feedback && <div className="mt-4 bg-green-50 p-4 rounded-lg border border-green-100 text-green-800 text-sm"><strong>Profesor:</strong> {task.feedback}</div>}
                    </div>
                )}

                {/* 2. TEACHER: CALIFICAR */}
                {user?.role === 'TEACHER' && task.status === 'SUBMITTED' && (
                    <form onSubmit={handleGrade} className="bg-blue-50 border border-blue-100 rounded-lg p-5">
                       <h3 className="font-bold text-blue-900 mb-4">Evaluar Entrega</h3>
                        <div className="flex gap-4 mb-4">
                            <div className="w-24">
                                <label className="block text-xs font-bold text-blue-800 mb-1">Nota</label>
                                <input type="number" min="0" max="100" required className="w-full border rounded p-2 text-center font-bold" value={grade} onChange={e => setGrade(Number(e.target.value))}/>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-blue-800 mb-1">Feedback</label>
                                <input type="text" className="w-full border rounded p-2" placeholder="..." value={feedback} onChange={e => setFeedback(e.target.value)}/>
                            </div>
                        </div>
                        <button disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm w-full">Guardar Calificación</button>
                    </form>
                )}

                {/* 3. STUDENT: AVISO DE ENTREGA (NUEVO - YA NO HAY FORMULARIO) */}
                {user?.role === 'STUDENT' && task.status === 'PENDING' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                        {isExpired ? (
                            <div className="text-red-500 flex flex-col items-center gap-2">
                                <Clock size={32} className="opacity-80" />
                                <p className="font-bold">El tiempo de entrega ha finalizado.</p>
                                <p className="text-sm text-gray-600">Contacta a tu profesor si necesitas ayuda.</p>
                            </div>
                        ) : (
                            <div className="text-gray-600">
                                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                                    <AlertTriangle size={24} />
                                </div>
                                <h4 className="font-bold text-gray-800 mb-1">¿Listo para entregar?</h4>
                                <p className="text-sm">
                                    Cierra esta ventana y usa el botón verde <span className="font-bold text-green-600">"Subir Tarea"</span> que aparece en tu lista de tareas.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. TEACHER: BORRAR */}
                {user?.role === 'TEACHER' && (
                    <div className="flex justify-center mt-8">
                        <button onClick={handleDelete} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 uppercase tracking-wider">
                            <Trash2 size={14} /> Eliminar Tarea
                        </button>
                    </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};