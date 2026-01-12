import { useEffect, useState } from 'react';
import { Loader2, BookOpen, Users, UserPlus } from 'lucide-react';
import { CreateCourseModal } from '../CreateCourseModal';
// 👇 Importamos el nuevo Modal
import { EnrollStudentModal } from './EnrollStudentModal'; 
import { getCourses, enrollStudent } from '../../services/course.service';
import type { Course } from '../../services/course.service';

interface Props {
  onUpdate?: () => void;
}

export const CoursesManagement = ({ onUpdate }: Props) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [enrollModal, setEnrollModal] = useState<{ isOpen: boolean; courseId: number | null; courseName: string }>({
    isOpen: false,
    courseId: null,
    courseName: ''
  });

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await getCourses();
      setCourses(data);
    } catch (error) {
      console.error("Error cargando cursos", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // 👇 AHORA SOLO ABRE EL MODAL
  const openEnrollModal = (course: Course) => {
    setEnrollModal({
        isOpen: true,
        courseId: course.id,
        courseName: course.name
    });
  };

  // 👇 ESTA FUNCIÓN ES LLAMADA POR EL MODAL CUANDO SELECCIONAS UN ALUMNO
  const handleEnrollSubmit = async (studentId: number) => {
    if (!enrollModal.courseId) return;

    // Ya no usamos try/catch aquí para los errores de negocio.
    // Dejamos que el error "suba" para que el Modal lo capture y lo muestre en rojo.
    await enrollStudent(enrollModal.courseId, studentId);
    
    // Si todo sale bien, recargamos la lista "por debajo"
    loadCourses(); 
  };

  const handleCourseCreated = () => {
    loadCourses();
    if (onUpdate) onUpdate();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             <BookOpen className="text-primary" /> Gestión de Cursos
           </h2>
           <p className="text-sm text-gray-500">Administra aulas, materias e inscripciones.</p>
        </div>
        <button 
          onClick={() => setIsCourseModalOpen(true)}
          className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all"
        >
          <BookOpen size={18} /> Nuevo Curso
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && courses.length === 0 ? (
           <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
           <>
            <div className="px-4 py-2 bg-blue-50 text-blue-800 text-xs font-bold rounded mb-4 w-fit border border-blue-100">
               Total Activos: {courses.length}
            </div>
            
            <ul className="space-y-4">
              {courses.map(course => (
                <li key={course.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-800">{course.name}</h3>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-bold border border-gray-300">
                          {course.code}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{course.description || 'Sin descripción'}</p>
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><BookOpen size={12}/> {course.subject.name}</span>
                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><Users size={12}/> Prof. {course.teacher.name}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 border-l pl-4 border-gray-100">
                      <div className="text-center min-w-[60px]">
                        <span className="block text-xl font-black text-gray-800">{course._count?.students || 0}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Alumnos</span>
                      </div>
                      <button 
                        onClick={() => openEnrollModal(course)}
                        className="flex items-center gap-1 text-sm bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded hover:bg-green-100 transition-colors font-bold"
                      >
                        <UserPlus size={16} /> Inscribir
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
           </>
        )}
      </div>

      <CreateCourseModal 
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCourseCreated={handleCourseCreated}
      />

      {/* 👇 NUESTRO MODAL DE INSCRIPCIÓN INTELIGENTE */}
      <EnrollStudentModal 
        isOpen={enrollModal.isOpen}
        onClose={() => setEnrollModal({ ...enrollModal, isOpen: false })}
        onEnroll={handleEnrollSubmit}
        courseName={enrollModal.courseName}
      />
    </div>
  );
};