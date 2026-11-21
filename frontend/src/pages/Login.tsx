import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginService } from '../services/auth.service';
import { Key, Mail, Loader2, AlertCircle, Sparkles, ShieldCheck, School, GraduationCap, BookOpen, Users } from 'lucide-react';

// Interfaz para manejo de errores de API
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

// Modo Demo: este proyecto es parte de un portafolio, no un sistema en
// producción con datos reales — por eso mostrar cuentas de prueba
// directamente aquí (en vez de solo en el README, donde un reclutador que
// hace clic en "Ver demo" nunca las vería) es la opción más profesional:
// deja a quien visita la demo avanzar más allá del login con un clic, sin
// pedirle que copie credenciales a mano. Se puede desactivar por completo
// definiendo VITE_DEMO_MODE=false (por ejemplo si este código se reutiliza
// como base para un cliente real).
const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';

interface DemoAccount {
  role: string;
  label: string;
  email: string;
  password: string;
  icon: typeof ShieldCheck;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'ADMIN', label: 'Admin (plataforma)', email: 'admin@aula.com', password: '123456', icon: ShieldCheck, color: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100' },
  { role: 'CENTRO', label: 'Centro educativo', email: 'centro@aula.com', password: '123456', icon: School, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
  { role: 'TEACHER', label: 'Profesor', email: 'teacher@aula.com', password: '123456', icon: BookOpen, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { role: 'STUDENT', label: 'Estudiante', email: 'student@aula.com', password: '123456', icon: GraduationCap, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { role: 'PARENT', label: 'Padre / Madre', email: 'parent@aula.com', password: '123456', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const [demoLoadingRole, setDemoLoadingRole] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    try {
      const data = await loginService({ email: loginEmail, password: loginPassword });

      if (!data.user.role) {
        throw new Error("Error de integridad: El usuario no tiene rol asignado.");
      }

      // Guardar sesión y redirigir
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      const msg = errorObj.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      setError(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await performLogin(email, password);
    setIsLoading(false);
  };

  const handleDemoLogin = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setDemoLoadingRole(account.role);
    await performLogin(account.email, account.password);
    setDemoLoadingRole(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className={`flex flex-col ${isDemoMode ? 'md:flex-row' : ''} w-full ${isDemoMode ? 'max-w-3xl' : 'max-w-md'} rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300`}>
      <div className="bg-white p-8 w-full md:max-w-md">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Key className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Bienvenido de nuevo</h1>
          <p className="text-gray-500 text-sm">Ingresa a tu Aula Virtual</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm font-bold mb-6 border border-red-100 animate-pulse">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="ejemplo@aula.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          Versión 1.0 &copy; 2025 AulaSystem
        </div>
      </div>

      {isDemoMode && (
        <div className="bg-slate-900 text-white p-8 w-full md:max-w-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-amber-400" />
            <h2 className="font-bold text-lg">Modo Demo</h2>
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Proyecto de portafolio con datos ficticios. Entra con un clic para explorar cualquier rol, sin necesidad de escribir credenciales.
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              const isThisLoading = demoLoadingRole === account.role;
              return (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => handleDemoLogin(account)}
                  disabled={demoLoadingRole !== null}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${account.color}`}
                >
                  {isThisLoading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                  <span>Entrar como {account.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-slate-500 text-[11px] mt-6 leading-relaxed">
            Credenciales de prueba (todas con contraseña <code className="bg-slate-800 px-1 rounded">123456</code>): admin@aula.com · centro@aula.com · teacher@aula.com · student@aula.com · parent@aula.com. Datos de ejemplo, sin información real.
          </p>
        </div>
      )}
    </div>
    </div>
  );
};