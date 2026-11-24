import { useEffect, useState } from 'react';
import { Loader2, LayoutDashboard, Users, BookOpen, Building2, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatsGrid } from '../StatsGrid';
import { StatDetailModal } from '../StatDetailModal';
import { UsersManagement } from '../admin/UsersManagement';
import { SubjectsManagement } from '../admin/SubjectsManagement';
import { CentersManagement } from '../admin/CentersManagement';
import { getDashboardStats } from '../../services/dashboard.service';
import { useAuth } from '../../context/AuthContext';
// 👇 Importamos el tipo correctamente
import type { DashboardStats } from '../../types/dashboard.types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', CENTRO: 'Centro', TEACHER: 'Profesores', STUDENT: 'Estudiantes', PARENT: 'Padres/Madres',
};

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ESTADO DE NAVEGACIÓN (TABS)
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'SUBJECTS' | 'CENTERS'>('OVERVIEW');

  // Popup de detalle al hacer clic en una tarjeta de stats.
  const [statModalType, setStatModalType] = useState<string | null>(null);

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
                {statsData && <StatsGrid stats={statsData.stats} onStatClick={(type) => setStatModalType(type ?? null)} />}

                {/* "Reportes que envían los centros sobre el sistema": un resumen
                    real (no inventado) de cada centro, con sus números y estado. */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <Building2 size={18} className="text-indigo-600" /> Resumen por Centro
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">Vista rápida de cada centro educativo dado de alta en la plataforma.</p>
                    {!statsData?.details?.centers || statsData.details.centers.length === 0 ? (
                        <p className="text-sm text-gray-400 italic py-4 text-center">Aún no hay centros registrados.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                                        <th className="pb-2 font-bold">Centro</th>
                                        <th className="pb-2 font-bold">Código</th>
                                        <th className="pb-2 font-bold text-center">Usuarios</th>
                                        <th className="pb-2 font-bold text-center">Materias</th>
                                        <th className="pb-2 font-bold text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {statsData.details.centers.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-2.5 font-bold text-gray-800">{c.name}</td>
                                            <td className="py-2.5 font-mono text-xs text-gray-500">{c.code}</td>
                                            <td className="py-2.5 text-center text-gray-600">{c.usersCount}</td>
                                            <td className="py-2.5 text-center text-gray-600">{c.subjectsCount}</td>
                                            <td className="py-2.5 text-center">
                                                {c.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> Activo</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={12} /> Inactivo</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <button
                        onClick={() => setActiveTab('CENTERS')}
                        className="mt-4 text-sm font-bold text-primary hover:underline"
                    >
                        Gestionar centros →
                    </button>
                </div>
            </div>
        )}

        <StatDetailModal
            isOpen={statModalType !== null}
            title={
                statModalType === 'admin_centers' ? 'Centros Educativos' :
                statModalType === 'admin_users' ? 'Usuarios de la Plataforma' :
                statModalType === 'admin_reports' ? 'Reportes de los Centros' : ''
            }
            onClose={() => setStatModalType(null)}
        >
            {statModalType === 'admin_centers' && (
                <div className="space-y-2">
                    {(statsData?.details?.centers ?? []).map((c) => (
                        <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                                <p className="text-xs text-gray-400">{c.usersCount} usuarios · {c.subjectsCount} materias</p>
                            </div>
                            {c.isActive ? (
                                <span className="text-xs font-bold text-green-600">Activo</span>
                            ) : (
                                <span className="text-xs font-bold text-red-600">Inactivo</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {statModalType === 'admin_users' && (
                <div className="space-y-2">
                    {Object.entries(statsData?.details?.usersByRole ?? {}).map(([role, count]) => (
                        <div key={role} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                            <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Users size={14} className="text-gray-400" /> {ROLE_LABELS[role] ?? role}</span>
                            <span className="text-sm font-bold text-gray-800">{count}</span>
                        </div>
                    ))}
                </div>
            )}
            {statModalType === 'admin_reports' && (
                <div className="text-center space-y-4 py-2">
                    <p className="text-gray-600 text-sm">
                        Estos son los mensajes sin leer que tus centros te han escalado (Admin solo conversa con cuentas Centro, así que tu bandeja de mensajes es, en la práctica, tu bandeja de reportes).
                    </p>
                    <button
                        onClick={() => { setStatModalType(null); navigate('/messages'); }}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                        <MessageCircle size={16} /> Ir a Mensajes
                    </button>
                </div>
            )}
        </StatDetailModal>

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
