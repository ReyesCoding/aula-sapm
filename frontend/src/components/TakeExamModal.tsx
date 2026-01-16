import { useEffect, useState } from 'react';
import { X, Clock, AlertCircle, Loader2 } from 'lucide-react'; // 1. Eliminado CheckCircle
import { getExamById, submitExamResponses } from '../services/exam.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  onExamSubmitted: () => void;
}

// 2. Definición de Tipos Estrictos para la estructura del Examen
interface Option {
  id: number;
  text: string;
}

interface Question {
  id: number;
  text: string;
  options: Option[];
}

interface ExamDetail {
  id: number;
  title: string;
  duration: number;
  questions: Question[];
}

export const TakeExamModal = ({ isOpen, onClose, examId, onExamSubmitted }: Props) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // 3. Estado tipado correctamente (Adiós 'any')
  const [exam, setExam] = useState<ExamDetail | null>(null);
  
  // Mapa de respuestas: { questionId: optionId }
  const [answers, setAnswers] = useState<Record<number, number>>({});
  
  // Estado para mostrar resultado final
  const [result, setResult] = useState<{ score: number } | null>(null);

  useEffect(() => {
    if (isOpen && examId) {
      loadExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, examId]);

  const loadExam = async () => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    try {
      // TypeScript inferirá que 'data' debe ajustarse a ExamDetail al setearlo
      const data = await getExamById(examId);
      setExam(data);
    } catch (error) {
      console.error("Error cargando examen", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: number, optionId: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleSubmit = async () => {
    if (!exam) return;

    // Validar que respondió todo
    if (Object.keys(answers).length < exam.questions.length) {
      const confirm = window.confirm("No has respondido todas las preguntas. ¿Seguro que quieres enviar?");
      if (!confirm) return;
    }

    setSubmitting(true);
    try {
      // Formatear respuestas para el backend
      const formattedAnswers = Object.entries(answers).map(([qId, oId]) => ({
        questionId: Number(qId),
        selectedOptionId: oId
      }));

      const response = await submitExamResponses({
        examId,
        answers: formattedAnswers
      });

      // ¡ÉXITO! Mostramos el resultado
      setResult({ score: response.score });
      
    } catch (error) {
      console.error(error);
      alert("Error enviando el examen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-bold text-gray-800">
               {loading ? "Cargando..." : (result ? "Resultados del Examen" : exam?.title)}
             </h2>
             {!loading && !result && (
               <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                 <Clock size={14}/> Duración: {exam?.duration} min
               </div>
             )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
          
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40}/></div>
          ) : result ? (
            // VISTA DE RESULTADOS (DESPUÉS DE ENVIAR)
            <div className="text-center py-10">
               <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-6">
                 <span className="text-4xl font-bold text-blue-700">{result.score.toFixed(0)}</span>
               </div>
               <h3 className="text-2xl font-bold text-gray-800 mb-2">
                 {result.score >= 70 ? "¡Felicidades! Aprobaste" : "Has finalizado el examen"}
               </h3>
               <p className="text-gray-500 mb-8">Tu calificación final ha sido registrada.</p>
               
               <button 
                 onClick={() => { onExamSubmitted(); onClose(); }}
                 className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-black transition"
               >
                 Cerrar y Volver
               </button>
            </div>
          ) : (
            // VISTA DE PREGUNTAS
            <div className="space-y-8">
              {/* 4. TypeScript ahora sabe que 'q' es Question */}
              {exam?.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-lg text-gray-800 mb-4 flex gap-2">
                    <span className="bg-blue-100 text-blue-700 text-sm px-2 py-0.5 rounded flex items-center h-fit mt-1">
                      {idx + 1}
                    </span>
                    {q.text}
                  </h4>
                  
                  <div className="space-y-3 pl-2">
                    {/* 5. TypeScript ahora sabe que 'opt' es Option */}
                    {q.options.map((opt) => (
                      <label 
                        key={opt.id} 
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                          answers[q.id] === opt.id 
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name={`question-${q.id}`} 
                          className="w-4 h-4 text-blue-600"
                          onChange={() => handleSelectOption(q.id, opt.id)}
                          checked={answers[q.id] === opt.id}
                        />
                        <span className="ml-3 text-gray-700">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        {!loading && !result && (
          <div className="p-4 border-t bg-white flex justify-between items-center">
            <div className="text-sm text-gray-500 flex items-center gap-2">
               <AlertCircle size={16} />
               {/* exam nunca es null aquí por la condición !loading, pero el operador ?. es seguro */}
               {Object.keys(answers).length} de {exam?.questions.length} respondidas
            </div>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-70"
            >
              {submitting && <Loader2 className="animate-spin" size={18}/>}
              Enviar Examen
            </button>
          </div>
        )}

      </div>
    </div>
  );
};