import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, GraduationCap, MessageCircle, CalendarDays } from 'lucide-react';
// 👇 1. Importamos el hook de navegación
import { useNavigate } from 'react-router-dom';
import { getGlobalUnreadCount } from '../services/messaging.service';

export const Navbar = () => {
  const { user, logout } = useAuth();
  // 👇 2. Inicializamos la navegación
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // 👇 3. Función intermedia para cerrar y redirigir
  const handleLogout = () => {
    logout();             // Borra token y usuario
    navigate('/login');   // Te manda a la pantalla de entrada
  };

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const count = await getGlobalUnreadCount();
        if (isMounted) setUnreadCount(count);
      } catch {
        // Silencioso: el badge simplemente no se actualiza si falla.
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // refresca cada 30s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

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
            <button
              onClick={() => navigate('/messages')}
              className="relative p-2 rounded-full hover:bg-blue-800 transition-colors"
              title="Mensajes"
            >
              <MessageCircle size={22} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/calendar')}
              className="p-2 rounded-full hover:bg-blue-800 transition-colors"
              title="Calendario"
            >
              <CalendarDays size={22} />
            </button>

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
