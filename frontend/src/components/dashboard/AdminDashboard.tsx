import { useEffect, useState } from 'react';
import { Loader2, LayoutDashboard, Users, BookOpen, Building2 } from 'lucide-react';
import { StatsGrid } from '../StatsGrid';
import { UsersManagement } from '../admin/UsersManagement';
import { SubjectsManagement } from '../admin/SubjectsManagement';
import { CentersManagement } from '../admin/CentersManagement';
import { getDashboardStats } from '../../services/dashboard.service';
import { useAuth } from '../../context/AuthContext';
// 👇 Importamos el tipo correctamente
import type { DashboardStats } from '../../types/dashboard.types';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // ESTADO DE NAVEGACIÓN (TABS)
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'SUBJECTS' | 'CENTERS'>('OVERVIEW');

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

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" size={40}/></div>;

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 px-4 space-y-6">
      
      {/* 1. Header de Bienvenida */}
      <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-primary flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Panel de Administrador 🎓</h2>
            <p className="text-gray-500">Bienvenido, {user?.name}. Tienes el control total de la plataforma.</p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-400">Fecha Actual</p>
            <p className="text-gray-800 font-mono">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* 2. Navegación (Tabs) */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'OVERVIEW' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            <LayoutDashboard size={16} /> Resumen
        </button>
        <button
            onClick={() => setActiveTab('USERS')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'USERS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            <Users size={16} /> Usuarios
        </button>
        <button
            onClick={() => setActiveTab('SUBJECTS')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'SUBJECTS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            <BookOpen size={16} /> Materias
        </button>
        <button
            onClick={() => setActiveTab('CENTERS')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'CENTERS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            <Building2 size={16} /> Centros
        </button>
      </div>

      {/* 3. Contenido Dinámico */}
      <div className="min-h-[500px]">
        {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-in fade-in duration-300">
                {/* 👇 CORRECCIÓN CRÍTICA: Pasamos statsData.stats */}
                {statsData && <StatsGrid stats={statsData.stats} />}
                
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center">
                    <p className="text-blue-800 font-medium">Selecciona una pestaña arriba para gestionar Usuarios, Materias o Centros.</p>
                </div>
            </div>
        )}

        {activeTab === 'USERS' && (
            <div className="animate-in fade-in duration-300">
                <UsersManagement />
            </div>
        )}

        {activeTab === 'SUBJECTS' && (
            <div className="animate-in fade-in duration-300">
                <SubjectsManagement onUpdate={loadData} />
            </div>
        )}

        {activeTab === 'CENTERS' && (
            <div className="animate-in fade-in duration-300">
                <CentersManagement onUpdate={loadData} />
            </div>
        )}
      </div>

    </div>
  );
};
