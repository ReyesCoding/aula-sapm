import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
// 👇 IMPORTANTE: Importamos AcademicDashboard porque SÍ lo usamos
import { AcademicDashboard } from '../components/dashboard/AcademicDashboard';
// ❌ BORRAMOS AdminDashboard porque NO lo estamos usando aún y causaba el error
import { Loader2, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!isAuthenticated || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-2 rounded-lg font-bold shadow-md shadow-blue-200">
                AS
              </div>
              <span className="font-bold text-xl text-gray-800 tracking-tight">
                Aula<span className="text-blue-600">System</span>
              </span>
            </div>

            {/* Zona de Usuario */}
            <div className="relative ml-3">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 focus:outline-none group"
              >
                 <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                      {user.role}
                    </p>
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1">
                      {user.name} <ChevronDown size={14} className={`text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                    </p>
                 </div>
                 
                 <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 border-2 border-white shadow-sm flex items-center justify-center text-gray-600 group-hover:border-blue-600 transition-colors">
                    <User size={20} />
                 </div>
              </button>

              {/* DROPDOWN MENU */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 py-1 z-20 animate-in fade-in zoom-in duration-200 origin-top-right">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>

                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                      <Settings size={16} /> Mi Perfil
                    </Link>

                    <button 
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut size={16} /> Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="py-6">
        {user.role === 'ADMIN' ? (
             <div className="text-center p-10 bg-white m-4 rounded shadow">
                <h2 className="text-xl font-bold text-gray-800">Panel de Administrador</h2>
                <p className="text-gray-500">Funcionalidad en construcción...</p>
             </div>
        ) : (
             // Aquí renderizamos el componente que YA TIENES creado
             <AcademicDashboard />
        )}
      </main>
    </div>
  );
};