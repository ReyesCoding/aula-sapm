import { useEffect, useState } from 'react';
import { X, User, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { getExamSubmissions, type ExamSubmissionResult } from '../services/exam.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  examTitle: string;
}

export const ExamResultsModal = ({ isOpen, onClose, examId, examTitle }: Props) => {
  const [submissions, setSubmissions] = useState<ExamSubmissionResult[]>([]);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && examId) {
      const fetchData = async () => {
        try {
          // Reiniciamos estados
          setError(null);
          // setLoading(true); // Ya inicia en true, evitamos re-render extra
          
          const data = await getExamSubmissions(examId);
          
          // 🔍 DEBUG: Ver en consola qué diablos está llegando
          console.log("ExamResultsModal - Respuesta Backend:", data);

          // 🛡️ GUARDIAN: Verificamos si es realmente un array
          if (!Array.isArray(data)) {
             throw new Error("El servidor devolvió un formato inválido (No es una lista)");
          }

          setSubmissions(data);
        } catch (err) {
          console.error("Error cargando resultados:", err);
          setError("No se pudieron cargar los resultados. Verifica la conexión.");
          setSubmissions([]); // Limpiamos para evitar errores de renderizado
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isOpen, examId]);

  if (!isOpen) return null;

  // 🛡️ CÁLCULO SEGURO: Usamos una variable auxiliar validada
  const validSubmissions = Array.isArray(submissions) ? submissions : [];

  const average = validSubmissions.length > 0 
    ? (validSubmissions.reduce((acc, curr) => acc + curr.score, 0) / validSubmissions.length).toFixed(1)
    : "0.0";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-gray-800">Resultados: {examTitle}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Entregas: {validSubmissions.length} | Promedio: {average} pts
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-0 overflow-y-auto bg-white flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-blue-600">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span className="text-sm font-medium">Cargando notas...</span>
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-500 flex flex-col items-center">
              <AlertCircle className="mb-2" size={32}/>
              <p className="font-bold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : validSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <User size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Nadie ha tomado este examen aún.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold sticky top-0">
                <tr>
                  <th className="p-4 border-b">Estudiante</th>
                  <th className="p-4 border-b text-center">Nota</th>
                  <th className="p-4 border-b text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {sub.student?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{sub.student?.name || "Desconocido"}</p>
                          <p className="text-xs text-gray-500">{sub.student?.email || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
                        {sub.score}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center">
                        {sub.score >= 70 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle size={14} /> Aprobado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle size={14} /> Reprobado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};