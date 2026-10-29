import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { 
  BookOpen, Users, FileText, CheckCircle, Clock, 
  TrendingUp, AlertCircle, Award, BrainCircuit, 
  ExternalLink, ArrowRight, X, Mail, PartyPopper 
} from 'lucide-react';

// --------------------------------------------------------
// 1. DEFINICIÓN DE INTERFACES
// --------------------------------------------------------

interface StatItem {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  type?: string;
  subtext?: string;
}

interface UserSummary { id: number; name: string; email?: string; }
interface SubjectSummary { id: number; name: string; }
interface StudentItem { student: UserSummary; subject: SubjectSummary; }
interface AssignmentTask { id: number; title: string; subject: SubjectSummary; student?: UserSummary; status?: string; grade?: number; }
interface ExamItem { id: number; title: string; subject: SubjectSummary; _count?: { submissions: number }; }

interface DashboardDetails {
  uniqueStudents?: StudentItem[];
  assignmentsToGrade?: AssignmentTask[];
  activeExams?: ExamItem[];
  pendingAssignments?: AssignmentTask[];
  pendingExams?: ExamItem[];
  completedAssignments?: AssignmentTask[]; 
}

interface DashboardData {
  stats: StatItem[];
  details: DashboardDetails;
}

interface Subject {
  id: number;
  name: string;
  code?: string;
  teacherId?: number;
  teacher?: { name: string; id: number };
  description?: string;
}

export function AcademicDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData>({ stats: [], details: {} });
  const [courses, setCourses] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const statsRes = await api.get('/dashboard/stats');
      setData(statsRes.data);

      const subjectsRes = await api.get('/subjects');
      let mySubjects: Subject[] = subjectsRes.data;

      if (user?.role === 'TEACHER') {
        mySubjects = subjectsRes.data.filter((s: Subject) => 
            s.teacherId === Number(user.id) || s.teacher?.id === Number(user.id)
        );
      }
      setCourses(mySubjects);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatClick = (type?: string) => {
    if (!type) return;
    const details = data.details || {};

    switch (type) {
        case 'teacher_students':
            setModalTitle('Mis Estudiantes Activos');
            setModalContent(
                <div className="space-y-3">
                    {(!details.uniqueStudents || details.uniqueStudents.length === 0) ? (
                        <p className="text-gray-500 italic">Aún no tienes estudiantes inscritos.</p>
                    ) : (
                        details.uniqueStudents.map((item: StudentItem, idx: number) => (
                            <div key={idx} className="p-3 border rounded-lg hover:bg-blue-50 flex items-center justify-between group transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                                        <Users size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{item.student?.name || 'Estudiante'}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <Mail size={10} /> {item.student?.email || 'Sin email'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 font-medium">
                                    {item.subject?.name || 'Sin materia'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            );
            setIsModalOpen(true);
            break;

        case 'teacher_review':
            setModalTitle('Tareas Pendientes de Revisión');
            setModalContent(
                <div className="space-y-3">
                    {(!details.assignmentsToGrade || details.assignmentsToGrade.length === 0) ? (
                        <div className="text-center py-6 text-gray-500">
                            <CheckCircle className="mx-auto mb-2 text-green-500" size={32}/>
                            <p>¡Todo revisado! Buen trabajo.</p>
                        </div>
                    ) : (
                        details.assignmentsToGrade.map((task: AssignmentTask) => (
                            <div key={task.id} className="p-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center cursor-pointer"
                                 onClick={() => { 
                                     setIsModalOpen(false); 
                                     navigate(`/subject/${task.subject.id}`, { state: { activeTab: 'assignments', highlightId: task.id } }); 
                                 }}>
                                <div>
                                    <p className="font-bold text-gray-800">{task.title}</p>
                                    <p className="text-xs text-gray-500">{task.subject?.name} • Alumno: {task.student?.name || 'N/A'}</p>
                                </div>
                                <ArrowRight size={16} className="text-blue-600"/>
                            </div>
                        ))
                    )}
                </div>
            );
            setIsModalOpen(true);
            break;

        case 'teacher_exams':
             setModalTitle('Exámenes en Curso');
             setModalContent(
                 <div className="space-y-3">
                     {(!details.activeExams || details.activeExams.length === 0) ? (
                         <p className="text-gray-500 italic">No hay exámenes activos.</p>
                     ) : (
                         details.activeExams.map((exam: ExamItem) => (
                             <div key={exam.id} className="p-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center cursor-pointer"
                                  onClick={() => { 
                                      setIsModalOpen(false); 
                                      navigate(`/subject/${exam.subject.id}`, { state: { activeTab: 'exams' } });
                                 }}>
                                 <div>
                                     <p className="font-bold text-gray-800">{exam.title}</p>
                                     <p className="text-xs text-gray-500">{exam.subject?.name} • Entregas: {exam._count?.submissions || 0}</p>
                                 </div>
                                 <ExternalLink size={16} className="text-purple-600"/>
                             </div>
                         ))
                     )}
                 </div>
             );
             setIsModalOpen(true);
             break;

        // 👇 FIX: Añadimos llaves {} para crear un bloque de ámbito (Scope Block)
        case 'student_pending': {
            setModalTitle('Actividades Pendientes');
            const hasPending = (details.pendingAssignments && details.pendingAssignments.length > 0) || (details.pendingExams && details.pendingExams.length > 0);
            
            setModalContent(
                <div className="space-y-4">
                    {!hasPending ? (
                        <div className="text-center py-8 bg-green-50 rounded-xl border border-green-100">
                            <PartyPopper className="mx-auto h-12 w-12 text-green-600 mb-2 animate-bounce" />
                            <h3 className="font-bold text-green-800 text-lg">¡Estás al día!</h3>
                            <p className="text-green-600 text-sm">No tienes tareas ni exámenes pendientes.</p>
                        </div>
                    ) : (
                        <>
                            {details.pendingAssignments && details.pendingAssignments.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Tareas ({details.pendingAssignments.length})</h4>
                                    {details.pendingAssignments.map((t: AssignmentTask) => (
                                         <div key={t.id} onClick={() => { setIsModalOpen(false); navigate(`/subject/${t.subject.id}`); }}
                                              className="p-3 border-l-4 border-orange-400 bg-orange-50 mb-2 cursor-pointer rounded-r hover:bg-orange-100 flex justify-between items-center group">
                                             <div>
                                                <p className="text-sm font-bold text-gray-800 group-hover:text-orange-700">{t.title}</p>
                                                <p className="text-xs text-gray-600">{t.subject?.name}</p>
                                             </div>
                                             <ArrowRight size={14} className="text-orange-400 opacity-0 group-hover:opacity-100 transition"/>
                                         </div>
                                    ))}
                                </div>
                            )}
                            {details.pendingExams && details.pendingExams.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Exámenes ({details.pendingExams.length})</h4>
                                    {details.pendingExams.map((e: ExamItem) => (
                                         <div key={e.id} onClick={() => { setIsModalOpen(false); navigate(`/subject/${e.subject.id}`); }}
                                              className="p-3 border-l-4 border-purple-400 bg-purple-50 mb-2 cursor-pointer rounded-r hover:bg-purple-100 flex justify-between items-center group">
                                             <div>
                                                <p className="text-sm font-bold text-gray-800 group-hover:text-purple-700">{e.title}</p>
                                                <p className="text-xs text-gray-600">{e.subject?.name}</p>
                                             </div>
                                             <ArrowRight size={14} className="text-purple-400 opacity-0 group-hover:opacity-100 transition"/>
                                         </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
            setIsModalOpen(true);
            break;
        }

        case 'student_completed':
            setModalTitle('Historial de Actividades');
            setModalContent(
                <div className="text-center py-6">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="text-blue-600" size={32}/>
                    </div>
                    <p className="text-gray-600">
                        Has completado <strong>{typeof data.stats[1]?.value === 'number' ? data.stats[1].value : 0}</strong> actividades.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Sigue así para mantener tu promedio alto.</p>
                </div>
            );
            setIsModalOpen(true);
            break;

        case 'student_average':
            setModalTitle('Desglose de Promedio');
            setModalContent(<p className="text-gray-600">Tu promedio se calcula en base a todas las tareas calificadas y exámenes realizados hasta la fecha.</p>);
            setIsModalOpen(true);
            break;

        case 'teacher_courses':
            document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' });
            break;
            
        default: break;
    }
  };

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = { 
        users: <Users size={24}/>, book: <BookOpen size={24}/>, file: <FileText size={24}/>, 
        check: <CheckCircle size={24}/>, clock: <Clock size={24}/>, 'trending-up': <TrendingUp size={24}/>, 
        alert: <AlertCircle size={24}/>, award: <Award size={24}/>, brain: <BrainCircuit size={24}/> 
    };
    return icons[iconName] || <FileText size={24}/>;
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = { 
        blue: 'bg-blue-50 text-blue-600 border-blue-100', green: 'bg-green-50 text-green-600 border-green-100', 
        purple: 'bg-purple-50 text-purple-600 border-purple-100', red: 'bg-red-50 text-red-600 border-red-100', 
        orange: 'bg-orange-50 text-orange-600 border-orange-100', yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100' 
    };
    return colors[color] || 'bg-gray-50 text-gray-600 border-gray-100';
  };

  const getGradient = (id: number) => {
    const gradients = ['from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600', 'from-orange-400 to-pink-600', 'from-purple-500 to-violet-600'];
    return gradients[(id || 0) % gradients.length];
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500 pb-10">
      
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Hola, <span className="text-blue-600">{user?.name}</span></h1>
        <p className="text-gray-500 mt-1">{user?.role === 'TEACHER' ? 'Panel de Gestión Académica' : 'Panel del Estudiante'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.stats.map((stat, idx) => (
          <div key={idx} onClick={() => handleStatClick(stat.type)}
            className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 group
              ${stat.type ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 ring-2 ring-transparent hover:ring-blue-50' : ''}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-gray-400 mb-1 uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-3xl font-extrabold text-gray-800">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl border ${getColorClasses(stat.color)}`}>{getIcon(stat.icon)}</div>
            </div>
            {stat.subtext && <div className="mt-4"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">{stat.subtext}</span></div>}
          </div>
        ))}
      </div>

      {/* SECCIÓN MATERIAS */}
      <div id="courses-section">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BookOpen className="text-blue-600"/> Mis Materias</h2>
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">{courses.length} Activas</span>
        </div>
        
        {courses.length === 0 ? (
             <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-200">
                 <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                 <h3 className="text-lg font-medium text-gray-900">No hay materias</h3>
                 {user?.role === 'STUDENT' && <p className="text-gray-500 text-sm mt-2">Únete a una clase con el código que te dio tu profesor.</p>}
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                    <div key={course.id} onClick={() => navigate(`/subject/${course.id}`)}
                        className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 group flex flex-col h-full">
                        <div className={`h-24 bg-gradient-to-r ${getGradient(course.id)} p-6 flex justify-between items-start`}>
                            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg text-white"><BookOpen size={24} /></div>
                            <span className="bg-black/20 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-md">
                                {course.code || `${course.name.substring(0, 3).toUpperCase()}-${course.id + 100}`}
                            </span>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">{course.name}</h3>
                                {user?.role === 'STUDENT' && course.teacher && <p className="text-sm text-gray-500 flex items-center gap-2"><Users size={14} /> Prof. {course.teacher.name}</p>}
                                <p className="text-sm text-gray-400 mt-2 line-clamp-2">{course.description || "Sin descripción"}</p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center text-blue-600 font-semibold text-sm"><span>Ver Aula</span><ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/></div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* MODAL INTERACTIVO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-800">{modalTitle}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {modalContent}
                </div>
                <div className="p-3 bg-gray-50 text-center">
                    <button onClick={() => setIsModalOpen(false)} className="text-sm text-gray-500 hover:text-gray-800 font-medium">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}