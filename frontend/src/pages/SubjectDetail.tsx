import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignmentsBySubject } from '../services/assignment.service';
import { getExamsBySubject, toggleExamResults } from '../services/exam.service';
// 👇 CORRECCIÓN 1: Agregado ArrowRight a los imports
import { Loader2, ArrowLeft, ArrowRight, Plus, FileText, BrainCircuit, Users, Calendar } from 'lucide-react';

import { CreateExamModal } from '../components/CreateExamModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { TakeExamModal } from '../components/TakeExamModal';
import { ExamResultsModal } from '../components/ExamResultsModal';

interface AssignmentSummary {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
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

export default function SubjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'assignments' | 'exams'>('assignments');
  const [loading, setLoading] = useState(true);
  
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  const [selectedExamInfo, setSelectedExamInfo] = useState<{
    id: number; 
    score: number | null; 
    isSubmitted: boolean;
  } | null>(null);

  const [resultsModalData, setResultsModalData] = useState<{id: number, title: string} | null>(null);
  
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
        setSubjectName(`Aula Virtual ${id}`);
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

  // 👇 CORRECCIÓN 2: Eliminamos la variable 'error' del catch porque no se usaba
  const handleToggleVisibility = async (examId: number) => {
    try {
        await toggleExamResults(examId);
        const updatedExams = await getExamsBySubject(Number(id));
        setExams(updatedExams);
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
                onClick={() => setIsTaskModalOpen(true)}
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
              activeTab === 'assignments' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={18}/> Tareas ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`pb-3 px-6 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'exams' 
                ? 'border-purple-600 text-purple-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BrainCircuit size={18}/> Exámenes ({exams.length})
          </button>
        </div>

        <div className="space-y-4">
          
          {activeTab === 'assignments' && (
            assignments.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
                No hay tareas publicadas aún.
              </div>
            ) : (
              <div className="grid gap-4">
                {assignments.map((task) => (
                  <div key={task.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-800">{task.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                    </div>
                    <div className="text-right">
                       <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600 flex items-center gap-1">
                         <Calendar size={12}/> Vence: {new Date(task.dueDate).toLocaleDateString()}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'exams' && (
            exams.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
                No hay exámenes creados en esta materia.
              </div>
            ) : (
              <div className="grid gap-4">
                {exams.map((exam) => {
                   const isExpired = exam.dueDate ? new Date(exam.dueDate) < new Date() : false;
                   const statusColor = isExpired ? "border-l-gray-400" : "border-l-purple-500";
                   const statusBadge = isExpired 
                      ? <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">Cerrado</span>
                      : <span className="text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Activo</span>;

                   return (
                  <div key={exam.id} className={`bg-white p-5 rounded-xl shadow-sm border border-l-4 ${statusColor} hover:shadow-md transition flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center`}>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-gray-800 text-lg">{exam.title}</h3>
                            {statusBadge}
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                            <p className="flex items-center gap-2">
                                <BrainCircuit size={14} className="text-purple-400"/> {exam._count.questions} Preguntas
                            </p>
                            {exam.dueDate ? (
                                <p className={`text-xs font-medium flex items-center gap-1 ${isExpired ? 'text-gray-400' : 'text-orange-600'}`}>
                                    <Calendar size={12}/> Vence: {new Date(exam.dueDate).toLocaleString()}
                                </p>
                            ) : (
                                <p className="text-xs text-gray-400 italic">Sin fecha límite</p>
                            )}
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
                             <span className={`px-3 py-1 rounded text-sm font-bold border ${
                                (exam.score || 0) >= 70 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-red-50 text-red-700 border-red-100'
                             }`}>
                              {exam.score} pts
                            </span>
                            <button 
                              onClick={() => setSelectedExamInfo({ 
                                id: exam.id, 
                                score: exam.score, 
                                isSubmitted: true 
                              })} 
                              className="text-gray-500 hover:text-blue-600 underline text-xs font-medium"
                            >
                              Ver corrección
                            </button>
                          </div>
                        ) : (
                          !isExpired ? (
                              <button 
                                onClick={() => setSelectedExamInfo({ 
                                    id: exam.id, 
                                    score: null, 
                                    isSubmitted: false 
                                })}
                                className="text-sm bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition shadow-sm font-bold flex items-center gap-2"
                              >
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
        </div>

        <CreateExamModal 
          isOpen={isExamModalOpen}
          onClose={() => setIsExamModalOpen(false)}
          subjectId={Number(id)}
          onSuccess={loadData}
        />

        {user?.role === 'TEACHER' && isTaskModalOpen && (
           <CreateTaskModal 
             isOpen={isTaskModalOpen}
             onClose={() => setIsTaskModalOpen(false)}
             onTaskCreated={loadData}
           />
        )}

        {selectedExamInfo && (
          <TakeExamModal
            isOpen={!!selectedExamInfo}
            onClose={() => setSelectedExamInfo(null)}
            examId={selectedExamInfo.id}
            initialScore={selectedExamInfo.score}
            isReviewMode={selectedExamInfo.isSubmitted}
            onExamSubmitted={loadData}
          />
        )}

        {resultsModalData && (
            <ExamResultsModal 
                isOpen={!!resultsModalData}
                onClose={() => setResultsModalData(null)}
                examId={resultsModalData.id}
                examTitle={resultsModalData.title}
            />
        )}

      </div>
    </div>
  );
}