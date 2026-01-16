import { useEffect, useState } from 'react';
import { Loader2, BookOpen, TrendingUp, ArrowRight } from 'lucide-react'; // 1. Limpiamos imports no usados
import { useAuth } from '../../context/AuthContext';
import { getSubjects, type Subject } from '../../services/subject.service';
import { getDashboardStats } from '../../services/dashboard.service';
import { useNavigate } from 'react-router-dom';
import { StatsGrid } from '../StatsGrid';
import type { DashboardStats } from '../../types/dashboard.types'; // 2. Importamos el tipo correcto

export const AcademicDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 3. Tipado estricto para las materias
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // 4. Tipado estricto para stats (Adiós 'any')
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Carga simultánea de Materias y Estadísticas
        const [subjectsData, statsData] = await Promise.all([
          getSubjects(),
          getDashboardStats()
        ]);
        
        setSubjects(subjectsData);
        setStats(statsData);

      } catch (error) {
        console.error("Error cargando dashboard", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8">
        
        {/* 1. Header Premium con Gradiente */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-700 p-8 shadow-lg text-white">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold flex items-center gap-3">
               Hola, {user?.name} <span className="animate-bounce">👋</span>
            </h2>
            <p className="mt-2 text-indigo-100 text-lg opacity-90">
              Bienvenido a tu panel de control académico. Tienes <span className="font-bold text-white">{subjects.length} aulas activas</span> hoy.
            </p>
          </div>
          {/* Decoración de fondo */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500 opacity-20 rounded-full blur-2xl"></div>
        </div>

        {/* 2. Grid de Estadísticas */}
        {stats && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-600"/> Resumen de Actividad
            </h3>
            {/* Renderizamos las estadísticas recuperadas */}
            <StatsGrid stats={stats.stats} />
          </div>
        )}

        {/* 3. Grid de Aulas (Diseño Moderno) */}
        <div>
           <div className="flex justify-between items-end border-b border-gray-200 pb-4 mb-6">
              <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                <BookOpen size={24} className="text-indigo-600"/> Mis Aulas Virtuales
              </h3>
              <span className="text-sm text-gray-500 hidden sm:block">Selecciona una tarjeta para entrar</span>
           </div>

           {subjects.length === 0 ? (
             <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-300 transition-colors">
               <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <BookOpen className="h-8 w-8 text-indigo-400" />
               </div>
               <h3 className="text-lg font-medium text-gray-900">Sin asignaciones académicas</h3>
               <p className="mt-2 text-gray-500 max-w-sm mx-auto">Parece que no tienes materias asignadas actualmente.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {subjects.map((subject, idx) => (
                 <div 
                   key={subject.id}
                   onClick={() => navigate(`/subject/${subject.id}`)}
                   className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-indigo-100 transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1"
                   style={{ animationDelay: `${idx * 100}ms` }}
                 >
                   {/* Header Visual de la Tarjeta */}
                   <div className={`h-24 w-full bg-gradient-to-r ${idx % 2 === 0 ? 'from-blue-500 to-cyan-500' : 'from-purple-500 to-pink-500'} relative`}>
                      <div className="absolute -bottom-6 left-6">
                        <div className="h-14 w-14 bg-white p-3 rounded-xl shadow-md flex items-center justify-center text-indigo-600">
                           <BookOpen size={28} />
                        </div>
                      </div>
                   </div>

                   <div className="pt-8 p-6">
                     <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-gray-800 group-hover:text-indigo-700 transition-colors line-clamp-1" title={subject.name}>
                          {subject.name}
                        </h3>
                     </div>
                     
                     <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-6">
                        Código: MAT-{subject.id}0{subject.id}
                     </p>
                     
                     {/* Contadores Numéricos Limpios */}
                     <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 p-2 rounded-lg text-center group-hover:bg-indigo-50 transition-colors">
                           <span className="block text-lg font-bold text-gray-700">{subject._count?.assignments || 0}</span>
                           <span className="text-[10px] text-gray-500 uppercase font-bold">Tareas</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg text-center group-hover:bg-purple-50 transition-colors">
                           <span className="block text-lg font-bold text-gray-700">{subject._count?.exams || 0}</span>
                           <span className="text-[10px] text-gray-500 uppercase font-bold">Exámenes</span>
                        </div>
                     </div>

                     <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-sm text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Ingresar al aula</span>
                        <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform"/>
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