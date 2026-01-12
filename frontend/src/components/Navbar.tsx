import { useAuth } from '../context/AuthContext';
import { LogOut, GraduationCap } from 'lucide-react';
// 👇 1. Importamos el hook de navegación
import { useNavigate } from 'react-router-dom';

export const Navbar = () => {
  const { user, logout } = useAuth();
  // 👇 2. Inicializamos la navegación
  const navigate = useNavigate();

  // 👇 3. Función intermedia para cerrar y redirigir
  const handleLogout = () => {
    logout();             // Borra token y usuario
    navigate('/login');   // Te manda a la pantalla de entrada
  };

  return (
    <nav className="bg-primary text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo y Nombre de la App */}
          <div className="flex items-center gap-2">
            <div className="bg-white p-1.5 rounded-full text-primary">
              <GraduationCap size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight">
              Aula System
            </span>
          </div>

          {/* Información del Usuario y Logout */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-blue-200 uppercase tracking-wide">
                {user?.role}
              </p>
            </div>
            
            <button 
              onClick={handleLogout} /* 👈 4. Usamos la nueva función aquí */
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 px-4 py-2 rounded-md transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              <span className="hidden md:inline">Cerrar Sesión</span>
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
};