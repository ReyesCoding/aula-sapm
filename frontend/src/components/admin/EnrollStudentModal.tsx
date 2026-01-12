import { useState, useEffect } from 'react';
import { Search, UserPlus, X, Loader2, User as UserIcon, Check, AlertCircle } from 'lucide-react';
// 👇 Importamos el tipo 'User' correctamente
import { searchUsers, type User } from '../../services/user.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // 👇 Ahora onEnroll devuelve una Promesa para saber si hubo error
  onEnroll: (studentId: number) => Promise<void>; 
  courseName?: string;
}

export const EnrollStudentModal = ({ isOpen, onClose, onEnroll, courseName }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [enrolling, setEnrolling] = useState(false); // Estado de carga al inscribir
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  
  // Estados para mensajes de feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Limpiar estados al cerrar o abrir
  useEffect(() => {
    if (isOpen) {
        setQuery('');
        setResults([]);
        setSelectedStudent(null);
        setError(null);
        setSuccess(null);
    }
  }, [isOpen]);

  // Efecto "Debounce" para buscar
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoadingSearch(true);
        try {
          const data = await searchUsers(query, 'STUDENT');
          setResults(data);
        } catch (error) {
          console.error(error);
        } finally {
          setLoadingSearch(false);
        }
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleEnrollClick = async () => {
    if (!selectedStudent) return;
    
    setEnrolling(true);
    setError(null);
    setSuccess(null);

    try {
        // Intentamos inscribir
        await onEnroll(selectedStudent.id);
        
        // Si no lanza error, fue exitoso
        setSuccess(`¡${selectedStudent.name} inscrito correctamente!`);
        
        // Cerramos el modal después de un breve momento para que vea el éxito
        setTimeout(() => {
            onClose();
        }, 1500);
        
    } catch (err: unknown) { // 👈 Usamos 'unknown' en lugar de 'any'
        // TypeScript seguro: Casteamos el error dentro para leer sus propiedades
        const error = err as { response?: { data?: { message?: string } }, message?: string };
        
        const msg = error.response?.data?.message || error.message || "Error al inscribir";
        setError(msg);
    } finally {
        setEnrolling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex justify-between items-center text-white">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <UserPlus size={20} /> Inscribir Estudiante
            </h3>
            <p className="text-blue-100 text-sm">Curso: {courseName}</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* FEEDBACK VISUAL (Alertas integradas) */}
        {error && (
            <div className="bg-red-50 text-red-600 px-6 py-3 text-sm font-bold border-b border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                <AlertCircle size={16} /> {error}
            </div>
        )}
        {success && (
            <div className="bg-green-50 text-green-600 px-6 py-3 text-sm font-bold border-b border-green-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                <Check size={16} /> {success}
            </div>
        )}

        <div className="p-6 space-y-4">
          {/* Buscador */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Buscar Alumno</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Escribe el nombre o email..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedStudent(null); 
                    setError(null); // Limpiar errores al buscar de nuevo
                }}
                autoFocus
                disabled={enrolling || !!success}
              />
            </div>
          </div>

          {/* Lista de Resultados */}
          <div className="border rounded-lg h-60 overflow-y-auto bg-gray-50 relative">
            {loadingSearch && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                 <Loader2 className="animate-spin text-primary" />
               </div>
            )}
            
            {!loadingSearch && results.length === 0 && query.length >= 2 && (
               <div className="p-4 text-center text-gray-500 text-sm">No se encontraron alumnos.</div>
            )}

            {!loadingSearch && query.length < 2 && (
               <div className="p-4 text-center text-gray-400 text-sm">Escribe al menos 2 letras para buscar.</div>
            )}

            {results.map(user => (
              <div 
                key={user.id}
                onClick={() => !enrolling && !success && setSelectedStudent(user)}
                className={`p-3 flex items-center justify-between cursor-pointer border-b border-gray-100 last:border-0 transition-colors
                  ${selectedStudent?.id === user.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-white'}
                  ${(enrolling || success) ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                   <div className="bg-gray-200 p-2 rounded-full text-gray-600">
                     <UserIcon size={16} />
                   </div>
                   <div>
                     <p className="font-bold text-gray-800 text-sm">{user.name}</p>
                     <p className="text-xs text-gray-500">{user.email}</p>
                   </div>
                </div>
                {selectedStudent?.id === user.id && <Check size={18} className="text-primary" />}
              </div>
            ))}
          </div>

          {/* Botón de Acción con estado de carga */}
          <button
            disabled={!selectedStudent || enrolling || !!success}
            onClick={handleEnrollClick}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all flex justify-center items-center gap-2
              ${selectedStudent && !enrolling && !success
                ? 'bg-green-600 hover:bg-green-700 shadow-md' 
                : 'bg-gray-300 cursor-not-allowed'}`}
          >
             {enrolling ? <Loader2 className="animate-spin" size={18}/> : <UserPlus size={18} />}
             {enrolling ? 'Inscribiendo...' : success ? '¡Listo!' : selectedStudent ? `Inscribir a ${selectedStudent.name}` : 'Selecciona un alumno'}
          </button>

        </div>
      </div>
    </div>
  );
};