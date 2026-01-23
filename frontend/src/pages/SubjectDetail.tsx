import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignmentsBySubject } from '../services/assignment.service';
import { getExamsBySubject, type ExamSummary } from '../services/exam.service';
import { Loader2, ArrowLeft, Plus, FileText, BrainCircuit } from 'lucide-react';

// 👇 IMPORTAMOS TODOS LOS MODALES
import { CreateExamModal } from '../components/CreateExamModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { TakeExamModal } from '../components/TakeExamModal';

interface AssignmentSummary {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  subject: { name: string };
}

export default function SubjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'assignments' | 'exams'>('assignments');
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE LOS MODALES ---
  const [isExamModalOpen, setIsExamModalOpen] = useState(false); // Profesor: Crear Examen
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // Profesor: Crear Tarea
  
  // 👇 CAMBIO IMPORTANTE: Estado para manejar la info del examen seleccionado (ID, Nota, Estado)
  const [selectedExamInfo, setSelectedExamInfo] = useState<{
    id: number; 
    score: number | null; 
    isSubmitted: boolean;
  } | null>(null);
  
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [subjectName, setSubjectName] = useState("Cargando materia...");

  // Función de carga de datos (Estable y reutilizable)
  const loadData = useCallback(async () => {
    if (!id) return;
    
    try {
      const [tasksData, examsData] = await Promise.all([
        getAssignmentsBySubject(Number(id)),
        getExamsBySubject(Number(id))
      ]);

      setAssignments(tasksData);
      setExams(examsData);

      if (tasksData.length > 0) {
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

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Navegación */}
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft size={20} className="mr-2"/> Volver al Dashboard
        </button>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{subjectName}</h1>
            <p className="text-gray-500">Aula Virtual ID: {id}</p>
          </div>
          
          {/* BOTONES PROFESOR */}
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

        {/* Pestañas */}
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

        {/* Contenido */}
        <div className="space-y-4">
          
          {/* VISTA: TAREAS */}
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
                       <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                         Vence: {new Date(task.dueDate).toLocaleDateString()}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* VISTA: EXÁMENES */}
          {activeTab === 'exams' && (
            exams.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
                No hay exámenes activos.
              </div>
            ) : (
              <div className="grid gap-4">
                {exams.map((exam) => (
                  <div key={exam.id} className="bg-white p-5 rounded-xl shadow-sm border border-l-4 border-l-purple-500 hover:shadow-md transition">
                    <h3 className="font-bold text-gray-800">{exam.title}</h3>
                    <p className="text-xs text-purple-600 font-medium mt-1">
                      {exam._count.questions} Preguntas
                    </p>
                    <div className="mt-3 flex justify-end">
                      
                      {/* 👇 AQUÍ ESTÁ LA LÓGICA DEL BOTÓN DE ESTUDIANTE ACTUALIZADA */}
                      {user?.role === 'STUDENT' ? (
                        exam.isSubmitted ? (
                          <div className="flex items-center justify-end gap-3">
                            {/* Pill de Nota NEUTRO (Azul) para no confundir con rojo/verde */}
                            <span className="px-3 py-1 rounded text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              {exam.score} pts
                            </span>
                            
                            {/* Botón para Ver Examen (Modo Revisión) */}
                            <button 
                              onClick={() => setSelectedExamInfo({ 
                                id: exam.id, 
                                score: exam.score, 
                                isSubmitted: true 
                              })} 
                              className="text-gray-500 hover:text-blue-600 underline text-sm"
                            >
                              Ver examen
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setSelectedExamInfo({ 
                                id: exam.id, 
                                score: null, 
                                isSubmitted: false 
                            })}
                            className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700 transition shadow-sm"
                          >
                            Comenzar Examen
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-gray-400 italic">Vista Profesor</span>
                      )}
                      
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* --- SECCIÓN DE MODALES --- */}
        
        {/* 1. Modal Profesor: Crear Examen */}
        <CreateExamModal 
          isOpen={isExamModalOpen}
          onClose={() => setIsExamModalOpen(false)}
          subjectId={Number(id)}
          onSuccess={loadData}
        />

        {/* 2. Modal Profesor: Crear Tarea */}
        {user?.role === 'TEACHER' && isTaskModalOpen && (
           <CreateTaskModal 
             isOpen={isTaskModalOpen}
             onClose={() => setIsTaskModalOpen(false)}
             onTaskCreated={loadData}
           />
        )}

        {/* 3. Modal Estudiante: Tomar/Ver Examen (ACTUALIZADO) */}
        {selectedExamInfo && (
          <TakeExamModal
            isOpen={!!selectedExamInfo}
            onClose={() => setSelectedExamInfo(null)}
            examId={selectedExamInfo.id}
            initialScore={selectedExamInfo.score}       // 👈 Nuevo Prop
            isReviewMode={selectedExamInfo.isSubmitted} // 👈 Nuevo Prop
            onExamSubmitted={loadData}
          />
        )}

      </div>
    </div>
  );
}