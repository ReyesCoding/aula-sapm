import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignmentsBySubject } from '../services/assignment.service';
import { getExamsBySubject, toggleExamResults } from '../services/exam.service';
import { Loader2, ArrowLeft, ArrowRight, Plus, FileText, BrainCircuit, Users, Calendar, Settings, Upload, CheckCircle, Award, ClipboardCheck, MessageCircle } from 'lucide-react';

// Componentes
import { CreateExamModal } from '../components/CreateExamModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { TakeExamModal } from '../components/TakeExamModal';
import { ExamResultsModal } from '../components/ExamResultsModal';
import { TaskManagementModal } from '../components/TaskManagementModal';
import { SubmitAssignmentModal } from '../components/SubmitAssignmentModal';
import { GradesPanel } from '../components/GradesPanel';
import { AttendancePanel } from '../components/AttendancePanel';
import { ForumPanel } from '../components/ForumPanel';

// ------------------------------------------------------------------
// 1. INTERFACES (Tipado estricto)
// ------------------------------------------------------------------

interface AssignmentSummary {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  status?: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE'; 
  grade?: number | null;
  subject: { name: string };
}

interface ExamSummary {
  id: number;
  title: string;
  dueDate: string | null;
  showResults: boolean;
  subject?: { name: string }; 
  _count: { questions: number };
  isSubmitted: boolean;
  score: number | null;
}

// 👇 Nueva interfaz para la edición de tareas
interface TaskToEdit {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  subjectId: number;
  attachmentUrl?: string;
}

// ------------------------------------------------------------------
// 2. COMPONENTE PRINCIPAL
// ------------------------------------------------------------------

export default function SubjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState<'assignments' | 'exams' | 'grades' | 'attendance' | 'forum'>('assignments');
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE MODALES ---
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskForManagement, setSelectedTaskForManagement] = useState<number | null>(null);
  const [resultsModalData, setResultsModalData] = useState<{id: number, title: string} | null>(null);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<{id: number, title: string} | null>(null);
  
  // 👇 AQUÍ ESTABA EL ERROR: Solo declaramos esto UNA vez y con el tipo correcto
  const [taskDataToEdit, setTaskDataToEdit] = useState<TaskToEdit | null>(null);

  const [selectedExamInfo, setSelectedExamInfo] = useState<{
    id: number; 
    score: number | null; 
    isSubmitted: boolean;
  } | null>(null);

  // Datos
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [subjectName, setSubjectName] = useState("Cargando materia...");

  const loadData = useCallback(async () => {
    if (!id) return;
    
    try {
      const [tasksData, examsData] = await Promise.all([
        getAssignmentsBySubject(Number(id)),
        getExamsBySubject(Number(id))
      ]);

      setAssignments(tasksData);
      setExams(examsData);

      if (examsData.length > 0 && examsData[0].subject) {
        setSubjectName(examsData[0].subject.name);
      } else if (tasksData.length > 0) {
        setSubjectName(tasksData[0].subject.name);
      } else {
        setSubjectName(`Aula Virtual`);
      }
      
    } catch (error) {
      console.error("Error cargando datos del aula:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // Navegación Inteligente
  useEffect(() => {
    if (location.state) {
        if (location.state.activeTab) {
            setActiveTab(location.state.activeTab);
        }
        if (location.state.highlightId && location.state.activeTab === 'assignments') {
            if (user?.role === 'TEACHER') {
                setSelectedTaskForManagement(location.state.highlightId);
            }
            window.history.replaceState({}, document.title);
        }
    }
  }, [location, user?.role]);

  const handleToggleVisibility = async (examId: number) => {
    try {
        await toggleExamResults(examId);
        setExams(prev => prev.map(e => e.id === examId ? { ...e, showResults: !e.showResults } : e));
    } catch {
        alert("Error al cambiar la visibilidad");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft size={20} className="mr-2"/> Volver al Dashboard
        </button>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{subjectName}</h1>
            <p className="text-gray-500">Panel de Actividades</p>
          </div>
          
          {user?.role === 'TEACHER' && (
            <div className="flex gap-3">
              <button 
                onClick={() => { setTaskDataToEdit(null); setIsTaskModalOpen(true); }} // Limpiamos edit data al crear nuevo
                className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition shadow-sm font-medium"
              >
                <Plus size={18}/> Nueva Tarea
              </button>
              <button 
                onClick={() => setIsExamModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-md font-medium"
              >
                <BrainCircuit size={18}/> Nuevo Examen
              </button>
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-3 px-6 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'assignments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={18}/> Tareas ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`pb-3 px-6 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'exams' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BrainCircuit size={18}/> Exámenes ({exams.length})
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`pb-3 px-6 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'grades' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award size={18}/> Calificaciones
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 px-6 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'attendance' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardCheck size={18}/> Asistencia
          </button>
          <button
            onClick={() => setActiveTab('forum')}
            className={`pb-3 px-6 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageCircle size={18}/> Foro
          </button>
        </div>

        <div className="space-y-4">
          
          {/* LISTA DE TAREAS */}
          {activeTab === 'assignments' && (
            assignments.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
                No hay tareas publicadas aún.
              </div>
            ) : (
              <div className="grid gap-4">
                {assignments.map((task) => {
                  const isSubmitted = task.status === 'SUBMITTED' || task.status === 'GRADED';
                  const isGraded = task.status === 'GRADED';
                  
                  return (
                  <div key={task.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition flex flex-col sm:flex-row justify-between sm:items-center gap-4 group">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{task.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{task.description || 'Sin descripción'}</p>
                      <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600 flex items-center gap-1 w-fit">
                            <Calendar size={12}/> {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                          
                          {user?.role === 'STUDENT' && (
                              isGraded ? (
                                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">
                                    Nota: {task.grade}/100
                                </span>
                              ) : isSubmitted ? (
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                    Entregado
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                    Pendiente
                                </span>
                              )
                          )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 self-end sm:self-center">
                        {user?.role === 'TEACHER' && (
                            <button 
                                onClick={() => setSelectedTaskForManagement(task.id)}
                                className="flex items-center gap-1 text-sm bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-md border border-gray-200 transition font-medium"
                            >
                                <Settings size={14} /> Gestionar
                            </button>
                        )}

                        {user?.role === 'STUDENT' && !isSubmitted && (
                            <button 
                                onClick={() => setSelectedTaskForSubmission({ id: task.id, title: task.title })}
                                className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition shadow-sm font-bold"
                            >
                                <Upload size={16} /> Entregar Tarea
                            </button>
                        )}
                        
                        {user?.role === 'STUDENT' && isSubmitted && (
                             <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                                <CheckCircle size={18}/> ¡Listo!
                             </div>
                        )}
                    </div>
                  </div>
                )})}
              </div>
            )
          )}

          {/* LISTA DE EXÁMENES */}
          {activeTab === 'exams' && (
            exams.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
                No hay exámenes creados.
              </div>
            ) : (
              <div className="grid gap-4">
                {exams.map((exam) => {
                   const isExpired = exam.dueDate ? new Date(exam.dueDate) < new Date() : false;
                   const statusColor = isExpired ? "border-l-gray-400" : "border-l-purple-500";
                   
                   return (
                  <div key={exam.id} className={`bg-white p-5 rounded-xl shadow-sm border border-l-4 ${statusColor} hover:shadow-md transition flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center`}>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-gray-800 text-lg">{exam.title}</h3>
                            {isExpired 
                              ? <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">Cerrado</span>
                              : <span className="text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Activo</span>
                            }
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                            <p className="flex items-center gap-2">
                                <BrainCircuit size={14} className="text-purple-400"/> {exam._count.questions} Preguntas
                            </p>
                        </div>
                    </div>

                    <div className="w-full sm:w-auto flex justify-end">
                      {user?.role === 'TEACHER' ? (
                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 select-none hover:text-gray-900 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={exam.showResults}
                                    onChange={() => handleToggleVisibility(exam.id)}
                                    className="accent-purple-600 w-4 h-4 cursor-pointer"
                                />
                                <span className="font-medium text-xs">Revisión {exam.showResults ? "ON" : "OFF"}</span>
                            </label>
                            <div className="h-6 w-px bg-gray-300 mx-1"></div>
                            <button 
                                onClick={() => setResultsModalData({ id: exam.id, title: exam.title })}
                                className="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center gap-1.5 px-2 py-1 rounded hover:bg-blue-50 transition"
                            >
                                <Users size={16}/> Resultados
                            </button>
                        </div>
                      ) : (
                        exam.isSubmitted ? (
                          <div className="flex flex-col items-end gap-1">
                             <span className={`px-3 py-1 rounded text-sm font-bold border ${ (exam.score || 0) >= 70 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100' }`}>
                              {exam.score} pts
                             </span>
                             <button onClick={() => setSelectedExamInfo({ id: exam.id, score: exam.score, isSubmitted: true })} className="text-gray-500 hover:text-blue-600 underline text-xs font-medium">
                              Ver corrección
                             </button>
                          </div>
                        ) : (
                          !isExpired ? (
                              <button onClick={() => setSelectedExamInfo({ id: exam.id, score: null, isSubmitted: false })}
                                className="text-sm bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm font-bold flex items-center gap-2">
                                Comenzar <ArrowRight size={16} />
                              </button>
                          ) : (
                              <span className="text-gray-400 text-sm italic font-medium bg-gray-100 px-3 py-1 rounded border">No entregado</span>
                          )
                        )
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )
          )}

          {/* CALIFICACIONES */}
          {activeTab === 'grades' && (
            <GradesPanel subjectId={Number(id)} />
          )}

          {/* ASISTENCIA */}
          {activeTab === 'attendance' && (
            <AttendancePanel subjectId={Number(id)} />
          )}

          {/* FORO */}
          {activeTab === 'forum' && (
            <ForumPanel subjectId={Number(id)} />
          )}
        </div>

        {/* ================= MODALES ================= */}
        
        {/* 1. CREAR EXAMEN */}
        <CreateExamModal isOpen={isExamModalOpen} onClose={() => setIsExamModalOpen(false)} subjectId={Number(id)} onSuccess={loadData} />
        
        {/* 2. CREAR/EDITAR TAREA (Híbrido) */}
        {user?.role === 'TEACHER' && isTaskModalOpen && (
           <CreateTaskModal 
              isOpen={isTaskModalOpen} 
              onClose={() => { setIsTaskModalOpen(false); setTaskDataToEdit(null); }} // Limpiar al cerrar
              onTaskCreated={loadData} 
              initialData={taskDataToEdit} // Pasamos la data si existe
           />
        )}
        
        {/* 3. GESTIONAR TAREA */}
        {user?.role === 'TEACHER' && selectedTaskForManagement && (
            <TaskManagementModal 
                isOpen={!!selectedTaskForManagement} 
                onClose={() => setSelectedTaskForManagement(null)} 
                assignmentId={selectedTaskForManagement}
                onTaskUpdated={loadData}
                onEditRequested={(data) => {
                    setTaskDataToEdit(data); // Guardamos la data a editar
                    setIsTaskModalOpen(true); // Abrimos el modal de creación (en modo edición)
                }}
            />
        )}

        {/* 4. ENTREGAR TAREA (Alumno) */}
        {user?.role === 'STUDENT' && selectedTaskForSubmission && (
            <SubmitAssignmentModal 
                isOpen={!!selectedTaskForSubmission} 
                onClose={() => setSelectedTaskForSubmission(null)} 
                assignmentId={selectedTaskForSubmission.id}
                assignmentTitle={selectedTaskForSubmission.title}
                onSuccess={loadData}
            />
        )}

        {/* 5. EXAMENES */}
        {selectedExamInfo && (
          <TakeExamModal isOpen={!!selectedExamInfo} onClose={() => setSelectedExamInfo(null)} examId={selectedExamInfo.id} initialScore={selectedExamInfo.score} isReviewMode={selectedExamInfo.isSubmitted} onExamSubmitted={loadData} />
        )}

        {resultsModalData && (
            <ExamResultsModal isOpen={!!resultsModalData} onClose={() => setResultsModalData(null)} examId={resultsModalData.id} examTitle={resultsModalData.title} />
        )}

      </div>
    </div>
  );
}