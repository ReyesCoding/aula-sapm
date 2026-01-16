import { useEffect, useState, useCallback } from 'react';
import { X, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { getExamById, submitExamResponses } from '../services/exam.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  onExamSubmitted: () => void;
  // 👇 Nuevas props para modo revisión
  initialScore?: number | null;
  isReviewMode?: boolean;
}

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
  duration: number; // en minutos
  questions: Question[];
}

export const TakeExamModal = ({ 
  isOpen, 
  onClose, 
  examId, 
  onExamSubmitted,
  initialScore,      // Recibimos la nota si ya existe
  isReviewMode = false // Flag para saber si es revisión
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  
  // ⏳ Estado del Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number } | null>(null);

  // 1️⃣ Memoizamos loadExam
  const loadExam = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    try {
      const data = await getExamById(examId);
      setExam(data);
      setTimeLeft(data.duration * 60);
    } catch (error) {
      console.error("Error cargando examen", error);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  // 2️⃣ Memoizamos handleSubmit
  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (!exam) return;

    if (!isAutoSubmit && Object.keys(answers).length < exam.questions.length) {
      const confirm = window.confirm("No has respondido todas las preguntas. ¿Seguro que quieres enviar?");
      if (!confirm) return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, oId]) => ({
        questionId: Number(qId),
        selectedOptionId: oId
      }));

      const response = await submitExamResponses({
        examId,
        answers: formattedAnswers
      });

      setResult({ score: response.score });
      
    } catch (error) {
      console.error(error);
      alert("Error enviando el examen.");
    } finally {
      setSubmitting(false);
    }
  }, [exam, answers, examId]);

  // 3️⃣ Efecto Principal: Carga de Datos o Modo Revisión
  useEffect(() => {
    if (!isOpen) return;

    // LÓGICA DE REVISIÓN: Si ya lo tomó, mostramos el resultado directo
    if (isReviewMode && initialScore !== undefined && initialScore !== null) {
        setResult({ score: initialScore });
        setLoading(false);
        return; 
    }

    // Si es un intento nuevo, cargamos el examen
    if (examId) {
      loadExam();
    }
  }, [isOpen, examId, isReviewMode, initialScore, loadExam]);

  // 4️⃣ Efecto del Timer
  useEffect(() => {
    // Si ya hay resultado (o estamos en review mode), paramos el timer
    if (timeLeft === null || result) return; 

    if (timeLeft === 0) {
        handleSubmit(true);
        return;
    }

    const timerId = setInterval(() => {
        setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, result, handleSubmit]);

  const handleSelectOption = (questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const timerColor = timeLeft && timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-gray-600';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-bold text-gray-800">
               {loading ? "Cargando..." : (result ? "Resultados" : exam?.title)}
             </h2>
             {!loading && !result && timeLeft !== null && (
               <div className={`flex items-center gap-2 text-lg font-mono font-bold mt-1 ${timerColor}`}>
                 <Clock size={20}/> 
                 {formatTime(timeLeft)}
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
            // VISTA RESULTADOS (Se muestra al enviar O al entrar en modo revisión)
            <div className="text-center py-10">
               <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${result.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                 <span className="text-4xl font-bold">{result.score.toFixed(0)}</span>
               </div>
               <h3 className="text-2xl font-bold text-gray-800 mb-2">
                 {result.score >= 70 ? "¡Aprobado!" : "Reprobado"}
               </h3>
               <p className="text-gray-500 mb-8">
                 {result.score >= 70 ? "Excelente trabajo." : "Sigue estudiando, tú puedes."}
               </p>
               
               <button 
                 onClick={() => { 
                    if (!isReviewMode) onExamSubmitted(); // Solo recargamos si acabamos de enviar
                    onClose(); 
                 }}
                 className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-black transition"
               >
                 Cerrar
               </button>
            </div>
          ) : (
            // VISTA PREGUNTAS (Solo si no hay resultado aún)
            <div className="space-y-8">
              {exam?.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-lg text-gray-800 mb-4 flex gap-2">
                    <span className="bg-blue-100 text-blue-700 text-sm px-2 py-0.5 rounded flex items-center h-fit mt-1">
                      {idx + 1}
                    </span>
                    {q.text}
                  </h4>
                  
                  <div className="space-y-3 pl-2">
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

        {/* FOOTER (Oculto si hay resultado) */}
        {!loading && !result && (
          <div className="p-4 border-t bg-white flex justify-between items-center">
            <div className="text-sm text-gray-500 flex items-center gap-2">
               <AlertCircle size={16} />
               {Object.keys(answers).length} de {exam?.questions.length} respondidas
            </div>
            <button 
              onClick={() => handleSubmit(false)}
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