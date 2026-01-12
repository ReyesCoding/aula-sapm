import { useState, useEffect } from 'react';
import { 
  FileText, Clock, CheckCircle, ChevronRight, 
  Calendar, CheckSquare, ListFilter, Upload, AlertTriangle 
} from 'lucide-react';
import { getAssignments } from '../services/assignment.service';
import type { Assignment } from '../services/assignment.service';
import { TaskDetailModal } from './TaskDetailModal';
import { SubmitTaskModal } from './SubmitTaskModal';
import { useAuth } from '../context/AuthContext';

// Componente autónomo, sin props externas
export const AssignmentsList = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ESTADO INTERNO: La lista controla su propio modal de detalles
  const [selectedTask, setSelectedTask] = useState<Assignment | null>(null);
  
  // ESTADOS PARA EL MODAL DE ENTREGA
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState<{id: number, title: string} | null>(null);

  // ESTADO PARA LOS FILTROS (Agregamos EXPIRED)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'EXPIRED' | 'SUBMITTED' | 'GRADED'>('ALL');

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const data = await getAssignments();
      setAssignments(data);
    } catch (error) {
      console.error("Error cargando tareas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const handleOpenSubmit = (e: React.MouseEvent, task: Assignment) => {
    e.stopPropagation();
    setSubmissionTarget({ id: task.id, title: task.title });
    setIsSubmitModalOpen(true);
  };

  // 👇 LÓGICA DE FILTRADO INTELIGENTE
  const filteredAssignments = assignments.filter(task => {
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const isExpired = now > dueDate;
    const isPending = task.status === 'PENDING' || task.status === 'LATE';

    if (filter === 'ALL') return true;

    // PENDING: Solo las pendientes que AÚN NO vencen
    if (filter === 'PENDING') return isPending && !isExpired;
    
    // EXPIRED: Las pendientes que YA vencieron
    if (filter === 'EXPIRED') return isPending && isExpired;

    if (filter === 'SUBMITTED') return task.status === 'SUBMITTED';
    if (filter === 'GRADED') return task.status === 'GRADED';
    return true;
  });

  const getStatusColor = (status: string, isExpired: boolean) => {
    if (status === 'PENDING' && isExpired) return 'bg-red-100 text-red-700 border-red-200'; // Vencida
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'SUBMITTED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'GRADED': return 'bg-green-100 text-green-700 border-green-200';
      case 'LATE': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string, isExpired: boolean) => {
    if (status === 'PENDING' && isExpired) return 'Vencida';
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'SUBMITTED': return 'Entregada';
      case 'GRADED': return 'Calificada';
      case 'LATE': return 'Atrasada';
      default: return status;
    }
  };

  // Contadores para las badges
  const pendingCount = assignments.filter(t => (t.status === 'PENDING' || t.status === 'LATE') && new Date() <= new Date(t.dueDate)).length;
  const expiredCount = assignments.filter(t => (t.status === 'PENDING' || t.status === 'LATE') && new Date() > new Date(t.dueDate)).length;

  if (loading) {
    return (
        <div className="p-8 text-center text-gray-500 animate-pulse">
            Cargando tareas...
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      
      {/* 1. BARRA DE FILTROS */}
      <div className="px-6 py-4 border-b border-gray-100 flex overflow-x-auto gap-2 no-scrollbar">
        <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${filter === 'ALL' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
            <ListFilter size={14} /> Todas
        </button>
        
        <button 
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${filter === 'PENDING' ? 'bg-yellow-500 text-white shadow-md' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
        >
            <Clock size={14} /> Pendientes
            {pendingCount > 0 && <span className="bg-white/30 px-1.5 rounded-md text-xs">{pendingCount}</span>}
        </button>

        {/* 👇 NUEVO FILTRO: VENCIDAS */}
        <button 
            onClick={() => setFilter('EXPIRED')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${filter === 'EXPIRED' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
        >
            <AlertTriangle size={14} /> Vencidas
            {expiredCount > 0 && <span className="bg-white/30 px-1.5 rounded-md text-xs">{expiredCount}</span>}
        </button>

        <button 
            onClick={() => setFilter('SUBMITTED')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${filter === 'SUBMITTED' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
        >
            <CheckSquare size={14} /> Entregadas
        </button>

        <button 
            onClick={() => setFilter('GRADED')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${filter === 'GRADED' ? 'bg-green-600 text-white shadow-md' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
        >
            <CheckCircle size={14} /> Calificadas
        </button>
      </div>

      {/* 2. LISTA DE TAREAS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <div className="bg-gray-50 p-4 rounded-full mb-3">
                    <FileText size={32} className="opacity-50" />
                </div>
                <p>No hay tareas en esta categoría.</p>
            </div>
        ) : (
            filteredAssignments.map((task) => {
                const dueDate = new Date(task.dueDate);
                const now = new Date();
                const isExpired = now > dueDate;

                return (
                    <div 
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="group bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer flex justify-between items-center relative overflow-hidden"
                    >
                        {/* Borde izquierdo de color según estado */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                             isExpired && task.status === 'PENDING' ? 'bg-red-500' :
                             task.status === 'PENDING' ? 'bg-yellow-400' :
                             task.status === 'GRADED' ? 'bg-green-500' :
                             task.status === 'SUBMITTED' ? 'bg-blue-500' : 'bg-gray-300'
                        }`}></div>

                        <div className="flex-1 pl-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    {task.subject.name}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getStatusColor(task.status, isExpired)}`}>
                                    {getStatusLabel(task.status, isExpired)}
                                </span>
                            </div>
                            <h4 className="font-bold text-gray-800 text-lg group-hover:text-primary transition-colors">
                                {task.title}
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                                 <span className={`flex items-center gap-1 ${isExpired && task.status === 'PENDING' ? 'text-red-600 font-bold' : ''}`}>
                                    <Calendar size={14}/> 
                                    {dueDate.toLocaleDateString()}
                                    {isExpired && task.status === 'PENDING' && " (Finalizó)"}
                                 </span>

                                 {task.grade !== undefined && task.grade !== null && (
                                    <span className="flex items-center gap-1 font-bold text-green-600 bg-green-50 px-2 rounded">
                                       Nota: {task.grade}/100
                                    </span>
                                 )}

                                 {/* BOTÓN SUBIR ARCHIVO */}
                                 {user?.role === 'STUDENT' && (task.status === 'PENDING' || task.status === 'LATE') && (
                                    <>
                                        {!isExpired ? (
                                            <button 
                                                onClick={(e) => handleOpenSubmit(e, task)}
                                                className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-bold z-10"
                                            >
                                                <Upload size={14} /> Subir Tarea
                                            </button>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 font-medium cursor-not-allowed">
                                                <Clock size={14} /> Tiempo agotado
                                            </span>
                                        )}
                                    </>
                                 )}
                            </div>
                        </div>
                        
                        <ChevronRight className="text-gray-300 group-hover:text-primary transition-transform group-hover:translate-x-1" />
                    </div>
                );
            })
        )}
      </div>

      <TaskDetailModal 
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onUpdate={() => {
            loadAssignments();
            setSelectedTask(null);
        }}
      />

      {submissionTarget && (
        <SubmitTaskModal 
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            assignmentId={submissionTarget.id}
            assignmentTitle={submissionTarget.title}
            onSubmitted={() => {
                loadAssignments(); 
            }}
        />
      )}

    </div>
  );
};