import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/user.service';
import { User, Shield, Key, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export const Profile = () => {
  // 1. CORRECCIÓN: Quitamos 'login' que no se usaba
  const { user, updateUser, logout } = useAuth();  
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
        setError("Las nuevas contraseñas no coinciden.");
        setLoading(false);
        return;
    }

    if (newPassword && !currentPassword) {
        setError("Para establecer una nueva contraseña, debes ingresar la actual.");
        setLoading(false);
        return;
    }

    try {
        // 2. CORRECCIÓN: No asignamos el resultado a una variable si no la vamos a usar
        await updateProfile({
            name,
            currentPassword: currentPassword || undefined,
            newPassword: newPassword || undefined
        });

        updateUser({ name });

       if (newPassword) {
    setSuccess("Contraseña actualizada. Cerrando sesión por seguridad...");
    setTimeout(() => {
        logout();
    }, 2000);
    return;
    }
        setSuccess("Perfil actualizado correctamente.");
        // Nota: El cambio de nombre se reflejará al recargar la página o volver a iniciar sesión
        
    } catch (err: unknown) { // 3. CORRECCIÓN: Usamos 'unknown' en lugar de 'any'
        // Casteamos el error de forma segura
        const errorObj = err as { response?: { data?: { message?: string } }, message?: string };
        const msg = errorObj.response?.data?.message || errorObj.message || "Error al actualizar perfil";
        setError(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <User className="text-primary" size={32} /> Mi Perfil
        </h1>
        <p className="text-gray-500 mt-2">Gestiona tu información personal y la seguridad de tu cuenta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: Tarjeta de Identidad */}
        <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                <div className="w-24 h-24 bg-gradient-to-tr from-blue-100 to-blue-50 rounded-full mx-auto flex items-center justify-center text-primary mb-4 shadow-inner">
                    <User size={48} />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{user?.name}</h2>
                <p className="text-sm text-gray-500 mb-4">{user?.email}</p>
                
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <Shield size={12} /> {user?.role}
                </div>
            </div>
        </div>

        {/* Columna Derecha: Formulario de Edición */}
        <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 text-sm font-bold border border-red-100 animate-in fade-in">
                        <AlertTriangle size={18} /> {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-3 text-sm font-bold border border-green-100 animate-in fade-in">
                        <CheckCircle size={18} /> {success}
                    </div>
                )}

                {/* Sección 1: Datos Básicos */}
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-50">
                        Información Básica
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Correo Electrónico (No editable)</label>
                            <input 
                                type="email"
                                value={user?.email}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                {/* Sección 2: Seguridad */}
                <div className="pt-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-50">
                        <Key size={18} className="text-amber-500" /> Seguridad
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Deja estos campos vacíos si no quieres cambiar tu contraseña.</p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                            <input 
                                type="password"
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                                <input 
                                    type="password"
                                    placeholder="Nueva contraseña"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva</label>
                                <input 
                                    type="password"
                                    placeholder="Repite la nueva"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end">
                    <button 
                        type="submit"
                        disabled={loading}
                        className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-blue-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>

            </form>
        </div>
      </div>
    </div>
  );
};