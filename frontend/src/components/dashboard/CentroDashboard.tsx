import { useEffect, useState } from 'react';
import { Loader2, Building2, Briefcase, LayoutDashboard } from 'lucide-react';
import { StatsGrid } from '../StatsGrid';
import { TeachersManagement } from '../centro/TeachersManagement';
import { getDashboardStats } from '../../services/dashboard.service';
import { useAuth } from '../../context/AuthContext';
import type { DashboardStats } from '../../types/dashboard.types';

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

  useEffect(() => {
    getDashboardStats()
      .then(setStatsData)
      .catch((err) => console.error('Error cargando estadísticas del centro:', err))
      .finally(() => setLoading(false));
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
        statsData && <StatsGrid stats={statsData.stats} />
      )}

      {/* Gestión de profesores (y, dentro de cada uno, sus materias) */}
      <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wide">
        <Briefcase size={14} /> Personal Docente
      </div>
      <TeachersManagement />
    </div>
  );
};
