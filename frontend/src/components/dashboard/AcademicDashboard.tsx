import { useEffect, useState } from 'react';
import { Loader2, BookOpen, GraduationCap, ClipboardList } from 'lucide-react'; // 1. Eliminado AlertTriangle
import { useAuth } from '../../context/AuthContext';
import { getSubjects, type Subject } from '../../services/subject.service'; // 2. Agregado "type" explícito
import { useNavigate } from 'react-router-dom';

export const AcademicDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getSubjects();
        setSubjects(data);
      } catch (error) {
        console.error("Error cargando materias", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" size={40}/></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header de Bienvenida */}
      <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             Hola, {user?.name} <span className="text-2xl animate-pulse">👋</span>
           </h2>
           <p className="text-gray-500 font-medium">Selecciona un aula para gestionar tareas y exámenes.</p>
        </div>
        <div className="text-right hidden sm:block bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-bold uppercase">Fecha</p>
            <p className="text-gray-700 font-mono font-bold">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: Perfil Rápido */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Tu Ficha</h3>
              <div className="space-y-4 text-sm">
                 <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">ID Interno</span>
                    <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 rounded">#{user?.id}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Rol Actual</span>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 shadow-sm">{user?.role}</span>
                 </div>
                 <div className="pt-2">
                    <p className="text-xs text-gray-400 mb-1 font-bold uppercase">Correo Electrónico</p>
                    <p className="font-medium text-gray-800 break-all">{user?.email}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Columna Derecha: GRID DE AULAS */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex justify-between items-end border-b border-gray-100 pb-2">
              <h3 className="font-bold text-gray-800 text-xl">Mis Aulas Virtuales</h3>
           </div>

           {subjects.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
               <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
               <h3 className="mt-2 text-sm font-medium text-gray-900">No tienes materias asignadas</h3>
               {user?.role === 'TEACHER' ? (
                   <p className="mt-1 text-sm text-gray-500">Espera a que el Administrador te asigne cursos.</p>
               ) : (
                   <p className="mt-1 text-sm text-gray-500">Contacta a tu profesor o administrador.</p>
               )}
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               {subjects.map((subject) => (
                 <div 
                   key={subject.id}
                   onClick={() => navigate(`/subject/${subject.id}`)}
                   className="group relative bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                 >
                   <div className="flex items-start justify-between mb-4">
                     <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                       <BookOpen size={24} />
                     </div>
                     <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                        ID: {subject.id}
                     </span>
                   </div>

                   <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-700 transition-colors mb-2">
                     {subject.name}
                   </h3>
                   
                   <div className="flex items-center gap-4 text-sm text-gray-500 mt-4 pt-4 border-t border-gray-50">
                     <div className="flex items-center gap-1.5" title="Tareas Activas">
                       <ClipboardList size={16} className="text-emerald-500"/>
                       <span className="font-medium">{subject._count?.assignments || 0}</span>
                     </div>
                     <div className="flex items-center gap-1.5" title="Exámenes Disponibles">
                       <GraduationCap size={16} className="text-purple-500"/>
                       <span className="font-medium">{subject._count?.exams || 0}</span>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>

      </div>
    </div>
  );
};