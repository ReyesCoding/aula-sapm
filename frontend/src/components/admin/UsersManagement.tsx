import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Trash2, Shield, GraduationCap, Briefcase, Loader2, Building2, Heart, Link2
} from 'lucide-react';
import { getAllUsers, createUser, deleteUser, type User } from '../../services/user.service';
import { getCenters, type EducationalCenter } from '../../services/center.service';
import { LinkChildModal } from './LinkChildModal';

const ROLES = ['STUDENT', 'TEACHER', 'CENTRO', 'PARENT', 'ADMIN'];

export const UsersManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [centers, setCenters] = useState<EducationalCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [linkModalParent, setLinkModalParent] = useState<{ id: number; name: string } | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
    educationalCenterId: '' as number | '',
  });

  const fetchUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    getCenters().then(setCenters).catch(() => setCenters([]));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (formData.role !== 'ADMIN' && !formData.educationalCenterId) {
      setCreateError('Selecciona el centro educativo para este usuario.');
      return;
    }

    try {
      await createUser({
        ...formData,
        educationalCenterId: formData.role !== 'ADMIN' ? Number(formData.educationalCenterId) : undefined,
      });
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'STUDENT', educationalCenterId: '' }); // Reset
      fetchUsers(); // Recargar lista
      alert('Usuario creado con éxito');
    } catch (error: unknown) {
      console.error(error);
      const errorObj = error as { response?: { data?: { message?: string } } };
      alert(errorObj.response?.data?.message || 'Error al crear usuario. Verifica que el email no exista.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.')) return;
    try {
      await deleteUser(id);
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar');
    }
  };

  // Helper para iconos de rol
  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'ADMIN': return <Shield size={16} className="text-red-500" />;
      case 'TEACHER': return <Briefcase size={16} className="text-blue-500" />;
      case 'CENTRO': return <Building2 size={16} className="text-indigo-500" />;
      case 'PARENT': return <Heart size={16} className="text-pink-500" />;
      default: return <GraduationCap size={16} className="text-green-500" />;
    }
  };

  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-50 text-red-700 border-red-200';
      case 'TEACHER': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CENTRO': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'PARENT': return 'bg-pink-50 text-pink-700 border-pink-200';
      default: return 'bg-green-50 text-green-700 border-green-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             <Users className="text-primary" /> Gestión de Usuarios
           </h2>
           <p className="text-sm text-gray-500">Administra el personal y estudiantes del colegio.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all"
        >
          <UserPlus size={18} /> Nuevo Usuario
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
           <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-primary" size={32} />
           </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 rounded-tl-lg">Nombre</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-right rounded-tr-lg">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-800">{user.name}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${getRoleBadgeClasses(user.role)}`}>
                      {getRoleIcon(user.role)} {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                  <td className="py-3 px-4 text-right">
                    {user.role === 'PARENT' && (
                      <button
                        onClick={() => setLinkModalParent({ id: user.id, name: user.name })}
                        className="text-gray-400 hover:text-indigo-500 transition-colors p-2 hover:bg-indigo-50 rounded-full"
                        title="Vincular hijos"
                      >
                        <Link2 size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                      title="Eliminar usuario"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Creación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-gray-800 text-white font-bold text-lg flex justify-between items-center">
               Crear Nuevo Usuario
               <button onClick={() => setShowModal(false)} className="opacity-70 hover:opacity-100">✕</button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{createError}</div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                <input type="text" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez"/>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input type="email" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none" 
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="usuario@aula.com"/>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
                <input type="password" required className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none" 
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="******"/>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
                <div className="grid grid-cols-3 gap-2">
                   {ROLES.map((role) => (
                     <button
                       key={role}
                       type="button"
                       onClick={() => setFormData({...formData, role})}
                       className={`py-2 px-1 rounded text-xs font-bold border transition-all 
                         ${formData.role === role 
                           ? 'bg-primary text-white border-primary shadow-md' 
                           : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                     >
                       {role}
                     </button>
                   ))}
                </div>
              </div>

              {formData.role !== 'ADMIN' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Centro Educativo</label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={formData.educationalCenterId}
                    onChange={e => setFormData({...formData, educationalCenterId: e.target.value ? Number(e.target.value) : ''})}
                  >
                    <option value="">Selecciona un centro...</option>
                    {centers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {centers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No hay centros creados todavía. Crea uno primero en la pestaña Centros.</p>
                  )}
                </div>
              )}

              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded mt-4 shadow-sm transition-colors">
                Guardar Usuario
              </button>
            </form>
          </div>
        </div>
      )}

      <LinkChildModal
        isOpen={linkModalParent != null}
        onClose={() => setLinkModalParent(null)}
        parentId={linkModalParent?.id ?? null}
        parentName={linkModalParent?.name ?? ''}
      />
    </div>
  );
};
