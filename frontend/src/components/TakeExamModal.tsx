import { useEffect, useState, useCallback } from 'react';
import { X, Clock, AlertCircle, Loader2, Check, XCircle } from 'lucide-react'; // ✅ XCircle se usa ahora
import { getExamById, submitExamResponses } from '../services/exam.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  onExamSubmitted: () => void;
  initialScore?: number | null;
  isReviewMode?: boolean;
}

interface Option {
  id: number;
  text: string;
  isCorrect?: boolean;
}

interface Question {
  id: number;
  text: string;
  points: number; 
  options: Option[];
}

interface ExamDetail {
  id: number;
  title: string;
  duration: number;
  showResults: boolean;
  questions: Question[];
}

export const TakeExamModal = ({ 
  isOpen, 
  onClose, 
  examId, 
  onExamSubmitted,
  initialScore,      
  isReviewMode = false 
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number } | null>(null);

  const loadExam = useCallback(async () => {
    setLoading(true);
    if (!isReviewMode) {
        setResult(null);
        setAnswers({});
    }

    try {
      const data = await getExamById(examId);
      setExam(data);
      if (!isReviewMode && !initialScore) {
          setTimeLeft(data.duration * 60);
      }
    } catch (error) {
      console.error("Error cargando examen", error);
    } finally {
      setLoading(false);
    }
  }, [examId, isReviewMode, initialScore]);

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

  useEffect(() => {
    if (!isOpen) return;
    loadExam();
    if (isReviewMode && initialScore !== undefined && initialScore !== null) {
        setResult({ score: initialScore });
    }
  }, [isOpen, examId, isReviewMode, initialScore, loadExam]);

  useEffect(() => {
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
               {loading ? "Cargando..." : (isReviewMode ? `Revisión: ${exam?.title}` : exam?.title)}
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
            // VISTA RESULTADOS
            (() => {
              const maxScore = exam?.questions.reduce((acc, q) => acc + (q.points || 1), 0) || 0;
              const percentage = maxScore > 0 ? (result.score / maxScore) * 100 : 0;
              const isPassed = percentage >= 70;

              return (
                <div className="space-y-8">
                   {/* Tarjeta de Calificación */}
                   <div className="text-center py-8 bg-white rounded-2xl shadow-sm border border-gray-100">
                      <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-4 border-4 ${isPassed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <div className="flex flex-col items-center">
                          <span className="text-4xl font-bold">{result.score.toFixed(1).replace(/\.0$/, '')}</span>
                          <span className="text-[10px] font-bold uppercase opacity-60 mt-1">de {maxScore} pts</span>
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-gray-800 mb-1">
                        {isPassed ? "¡Aprobado!" : "Reprobado"}
                      </h3>
                      <p className="text-gray-500">
                        Obtuviste el <strong className="text-gray-700">{percentage.toFixed(0)}%</strong> de la calificación.
                      </p>
                   </div>

                   {/* DETALLE DE RESPUESTAS */}
                   {isReviewMode && exam?.showResults ? (
                       <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                          <h4 className="font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                             <Check size={18} className="text-green-600"/> Revisión de Respuestas
                          </h4>
                          {exam.questions.map((q, idx) => (
                             <div key={q.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <p className="font-bold text-gray-800 mb-3 flex gap-2">
                                   <span className="text-blue-600">#{idx+1}</span> {q.text} 
                                   <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded h-fit ml-auto">{q.points} pts</span>
                                </p>
                                <div className="space-y-2">
                                   {q.options.map(opt => {
                                      // 👇 LÓGICA DE COLOR CORREGIDA (SENIOR) - Ahora usamos las variables
                                      const isSelected = answers[q.id] === opt.id;
                                      const isCorrect = opt.isCorrect;
                                      
                                      let itemClass = 'border-transparent text-gray-500';
                                      let icon = null;

                                      if (isCorrect) {
                                          itemClass = 'bg-green-50 border-green-200 text-green-800 font-medium';
                                          icon = <Check size={16} className="text-green-600" />;
                                      } else if (isSelected && !isCorrect) {
                                          // 🔴 Aquí usamos XCircle e isSelected para marcar el error del usuario
                                          itemClass = 'bg-red-50 border-red-200 text-red-800 font-medium';
                                          icon = <XCircle size={16} className="text-red-600" />;
                                      }

                                      return (
                                        <div key={opt.id} className={`p-2 rounded border flex justify-between items-center ${itemClass}`}>
                                           <span>{opt.text}</span>
                                           {icon}
                                        </div>
                                      );
                                   })}
                                </div>
                             </div>
                          ))}
                       </div>
                   ) : isReviewMode ? (
                       <div className="text-center p-6 bg-blue-50 text-blue-800 rounded-lg text-sm flex flex-col items-center">
                           <AlertCircle className="mb-2" size={24}/>
                           <p>El profesor no ha habilitado la revisión detallada de respuestas para este examen.</p>
                       </div>
                   ) : null}

                   <div className="text-center pt-4">
                     <button 
                       onClick={() => { 
                          if (!isReviewMode) onExamSubmitted(); 
                          onClose(); 
                       }}
                       className="bg-gray-800 text-white px-8 py-3 rounded-lg hover:bg-black transition font-bold shadow-lg w-full sm:w-auto"
                     >
                       Cerrar
                     </button>
                   </div>
                </div>
              );
            })()
          ) : (
            // VISTA PREGUNTAS
            <div className="space-y-8">
              {exam?.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <h4 className="font-bold text-lg text-gray-800 flex gap-3">
                        <span className="bg-blue-100 text-blue-700 text-sm font-bold px-2.5 py-1 rounded-lg flex items-center h-fit">
                        {idx + 1}
                        </span>
                        <span className="mt-0.5">{q.text}</span>
                    </h4>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded self-start whitespace-nowrap">
                        {q.points || 1} pts
                    </span>
                  </div>
                  
                  <div className="space-y-3 pl-2">
                    {q.options.map((opt) => (
                      <label 
                        key={opt.id} 
                        className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                          answers[q.id] === opt.id 
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm' 
                            : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-colors ${
                            answers[q.id] === opt.id ? 'border-blue-600 bg-blue-600' : 'border-gray-400'
                        }`}>
                            {answers[q.id] === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input 
                          type="radio" 
                          name={`question-${q.id}`} 
                          className="hidden" 
                          onChange={() => handleSelectOption(q.id, opt.id)}
                          checked={answers[q.id] === opt.id}
                        />
                        <span className={`text-base ${answers[q.id] === opt.id ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                            {opt.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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