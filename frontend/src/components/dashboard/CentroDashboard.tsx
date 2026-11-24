import { useEffect, useState } from 'react';
import { Loader2, Building2, Briefcase, LayoutDashboard, GraduationCap, Users } from 'lucide-react';
import { StatsGrid } from '../StatsGrid';
import { StatDetailModal } from '../StatDetailModal';
import { TeachersManagement } from '../centro/TeachersManagement';
import { StudentsManagement } from '../centro/StudentsManagement';
import { ParentsManagement } from '../centro/ParentsManagement';
import { getDashboardStats } from '../../services/dashboard.service';
import { useAuth } from '../../context/AuthContext';
import type { DashboardStats } from '../../types/dashboard.types';

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Profesores', STUDENT: 'Estudiantes', PARENT: 'Padres/Madres', CENTRO: 'Centro',
};

/**
 * Dashboard dedicado al rol CENTRO (v3.0, nov. 2026).
 *
 * Antes Dashboard.tsx mandaba a CENTRO a la misma `AcademicDashboard` que
 * Profesor/Estudiante/Padre usan para ver y administrar SUS PROPIAS
 * materias ("Mis Materias" + botón de "Nueva Materia" sueltos) — lo que
 * hacía parecer que Centro impartía clases directamente. El trabajo de
 * Centro es administrar a su personal docente (altas, bajas, qué materias
 * imparte cada quien), no operar materias — ver TeachersManagement.tsx.
 *
 * El título largo del usuario CENTRO ("Administración Centro Legacy" en
 * versiones previas de los datos de ejemplo) rompía el layout del header
 * compartido — aquí el encabezado está pensado para nombres largos desde
 * el inicio (ajusta el tamaño de letra y permite salto de línea en vez de
 * desbordar o recortar el texto).
 */
export const CentroDashboard = () => {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TEACHERS' | 'STUDENTS' | 'PARENTS'>('OVERVIEW');
  const [statModalType, setStatModalType] = useState<string | null>(null);

  const loadStats = () => {
    getDashboardStats()
      .then(setStatsData)
      .catch((err) => console.error('Error cargando estadísticas del centro:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 px-4 space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-indigo-500">
        <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wide mb-1">
          <Building2 size={14} /> Panel de Administración del Centro
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words leading-tight">
          Hola, {user?.name}
        </h1>
        <p className="text-gray-500 mt-1 flex items-center gap-1.5 text-sm">
          <LayoutDashboard size={14} /> Gestiona el profesorado y las materias de tu centro educativo.
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" size={40} /></div>
      ) : (
        statsData && <StatsGrid stats={statsData.stats} onStatClick={(type) => setStatModalType(type ?? null)} />
      )}

      {/* Navegación (Tabs) — Profesores/Estudiantes/Padres visualmente
          separados (pedido explícito: "no esté todo mezclado"). */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'OVERVIEW' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <LayoutDashboard size={16} /> Resumen
        </button>
        <button
          onClick={() => setActiveTab('TEACHERS')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'TEACHERS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Briefcase size={16} /> Profesores
        </button>
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'STUDENTS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <GraduationCap size={16} /> Estudiantes
        </button>
        <button
          onClick={() => setActiveTab('PARENTS')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'PARENTS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={16} /> Padres/Madres
        </button>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'OVERVIEW' && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center animate-in fade-in duration-300">
            <p className="text-blue-800 font-medium">Selecciona una pestaña arriba para gestionar Profesores, Estudiantes o Padres/Madres.</p>
          </div>
        )}
        {activeTab === 'TEACHERS' && <div className="animate-in fade-in duration-300"><TeachersManagement /></div>}
        {activeTab === 'STUDENTS' && <div className="animate-in fade-in duration-300"><StudentsManagement /></div>}
        {activeTab === 'PARENTS' && <div className="animate-in fade-in duration-300"><ParentsManagement /></div>}
      </div>

      <StatDetailModal
        isOpen={statModalType !== null}
        title={
          statModalType === 'centro_users' ? 'Usuarios del Centro' :
          statModalType === 'centro_subjects' ? 'Materias Activas' :
          statModalType === 'centro_assignments' ? 'Actividades' :
          statModalType === 'centro_pending' ? 'Solicitudes Pendientes' : ''
        }
        onClose={() => setStatModalType(null)}
      >
        {statModalType === 'centro_users' && (
          <div className="space-y-2">
            {Object.entries(statsData?.details?.usersByRole ?? {}).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                <span className="text-sm font-bold text-gray-700">{ROLE_LABELS[role] ?? role}</span>
                <span className="text-sm font-bold text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        )}
        {statModalType === 'centro_subjects' && (
          <p className="text-gray-600 text-sm">
            Materias activas dadas de alta por el profesorado de tu centro. Para ver el detalle y reasignarlas, entra a la pestaña "Profesores".
          </p>
        )}
        {statModalType === 'centro_assignments' && (
          <p className="text-gray-600 text-sm">
            Total de tareas creadas en todas las materias de tu centro (entregadas, pendientes o calificadas).
          </p>
        )}
        {statModalType === 'centro_pending' && (
          <p className="text-gray-600 text-sm">
            Solicitudes de estudiantes que ya se unieron con el código de una materia pero todavía esperan que el profesor titular los acepte. Cada profesor las revisa desde el detalle de su propia materia.
          </p>
        )}
      </StatDetailModal>
    </div>
  );
};
