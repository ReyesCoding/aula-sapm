import { useEffect, useState } from 'react';
import { Loader2, BookOpen, Users, Plus } from 'lucide-react';
import { CreateSubjectModal } from '../CreateSubjectModal';
import { getSubjects, type Subject } from '../../services/subject.service';

interface Props {
  onUpdate?: () => void;
}

export const SubjectsManagement = ({ onUpdate }: Props) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Error cargando materias', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const handleCreated = () => {
    loadSubjects();
    if (onUpdate) onUpdate();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             <BookOpen className="text-primary" /> Gestión de Materias
           </h2>
           <p className="text-sm text-gray-500">
             Administra las materias de tu(s) centro(s). Los estudiantes se inscriben con el código; el profesor aprueba desde su panel.
           </p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all"
        >
          <Plus size={18} /> Nueva Materia
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
           <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-primary" /></div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            Aún no hay materias registradas.
          </div>
        ) : (
           <>
            <div className="px-4 py-2 bg-blue-50 text-blue-800 text-xs font-bold rounded mb-4 w-fit border border-blue-100">
               Total Activas: {subjects.length}
            </div>
            
            <ul className="space-y-4">
              {subjects.map(subject => (
                <li key={subject.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-800">{subject.name}</h3>
                        {subject.code && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-bold border border-gray-300">
                            {subject.code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{subject.description || 'Sin descripción'}</p>
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><Users size={12}/> Prof. {subject.teacher?.name || 'Sin asignar'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 border-l pl-4 border-gray-100">
                      <div className="text-center min-w-[60px]">
                        <span className="block text-xl font-black text-gray-800">{subject._count?.enrollments ?? 0}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Alumnos</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
           </>
        )}
      </div>

      <CreateSubjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};
