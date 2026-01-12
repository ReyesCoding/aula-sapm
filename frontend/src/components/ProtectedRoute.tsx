import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-gray-500 font-medium animate-pulse">Cargando sistema...</p>
            </div>
        </div>
    );
  }

  // Si no hay usuario o no está autenticado, redirigir al login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};