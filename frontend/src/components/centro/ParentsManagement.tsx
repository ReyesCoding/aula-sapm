import { useEffect, useState } from 'react';
import { Users, Loader2, Mail, GraduationCap } from 'lucide-react';
import { getAllUsers, getParentChildren, type User, type ChildSummary } from '../../services/user.service';

/**
 * Panel de "Padres/Madres" para el rol CENTRO (v3.1).
 *
 * De solo-lectura por ahora: las cuentas de Padre/Madre se crean desde
 * StudentsManagement.tsx (en el mismo registro que su hijo, o vinculando
 * una ya existente a un segundo hijo) — este panel es la vista separada
 * que pide el feedback de producto ("mantener Profesores/Estudiantes/
 * Padres visualmente bien separados, no todo mezclado"), mostrando a qué
 * hijo(s) está vinculado cada padre/madre.
 */
export const ParentsManagement = () => {
  const [parents, setParents] = useState<User[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<Record<number, ChildSummary[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const parentsData = await getAllUsers('PARENT');
        setParents(parentsData);
        const entries = await Promise.all(
          parentsData.map(async (p) => [p.id, await getParentChildren(p.id)] as const)
        );
        setChildrenByParent(Object.fromEntries(entries));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col min-h-[500px]">
      <div className="p-6 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-primary" /> Padres y Madres
        </h2>
        <p className="text-sm text-gray-500">
          Se crean desde la ficha del estudiante (pestaña Estudiantes), junto con su matrícula.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : parents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            Aún no hay padres/madres registrados en tu centro.
          </div>
        ) : (
          <ul className="space-y-3">
            {parents.map((parent) => {
              const children = childrenByParent[parent.id] ?? [];
              return (
                <li key={parent.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800">{parent.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mb-2"><Mail size={12} /> {parent.email}</p>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                      <GraduationCap size={12} /> Hijo(s) vinculado(s)
                    </p>
                    {children.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Sin hijos vinculados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {children.map((c) => (
                          <span key={c.id} className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
