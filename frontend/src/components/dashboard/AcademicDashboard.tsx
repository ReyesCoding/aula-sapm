import { useEffect, useState } from 'react';
import { Loader2, Plus, AlertTriangle } from 'lucide-react'; // Importamos AlertTriangle
import { StatsGrid } from '../StatsGrid';
import { AssignmentsList } from '../AssignmentsList'; 
import { getDashboardStats } from '../../services/dashboard.service';
import { useAuth } from '../../context/AuthContext';
import type { DashboardStats } from '../../types/dashboard.types';
import { CreateTaskModal } from '../CreateTaskModal';

export const AcademicDashboard = () => {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = async () => {
    try {
      const data = await getDashboardStats();
      setStatsData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 🧠 LÓGICA DE VALIDACIÓN SENIOR
  // Buscamos en las estadísticas si hay cursos activos.
  // El backend envía un ítem con icon: 'book' y label 'Mis Cursos' (o 'Cursos Activos').
  // Verificamos si ese valor es mayor a 0.
  const coursesCount = statsData?.stats.find(s => s.icon === 'book')?.value || 0;
  const hasCourses = Number(coursesCount) > 0;

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" size={40}/></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header de Bienvenida con Fondo Sutil */}
      <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             Hola, {user?.name} <span className="text-2xl animate-pulse">👋</span>
           </h2>
           <p className="text-gray-500 font-medium">Aquí tienes el resumen de tu actividad académica.</p>
        </div>
        <div className="text-right hidden sm:block bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-bold uppercase">Fecha</p>
            <p className="text-gray-700 font-mono font-bold">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Grid de Estadísticas */}
      {statsData && <StatsGrid stats={statsData.stats} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: Perfil Rápido */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

        {/* Columna Derecha: Tareas */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex justify-between items-end border-b border-gray-100 pb-2">
              <h3 className="font-bold text-gray-800 text-xl">Tareas Asignadas</h3>
              
              {/* 🛡️ RENDERIZADO CONDICIONAL DEL BOTÓN */}
              {user?.role === 'TEACHER' && (
                hasCourses ? (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <Plus size={18} /> Nueva Tarea
                  </button>
                ) : (
                  // MENSAJE DE SEGURIDAD SI NO TIENE CURSOS
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 text-xs font-bold" title="No puedes crear tareas sin cursos asignados">
                     <AlertTriangle size={14} /> Requiere Asignación de Curso
                  </div>
                )
              )}
           </div>

            <AssignmentsList key={refreshTrigger} />

        </div>

      </div>

      {user?.role === 'TEACHER' && hasCourses && (
        <CreateTaskModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
         onTaskCreated={() => {
        loadData(); // Recarga las estadísticas de arriba
        setRefreshTrigger(prev => prev + 1); // 👈 Recarga la lista de abajo
        }} 
        />
      )}

    </div>
  );
};