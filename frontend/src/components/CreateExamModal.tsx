import { useState } from 'react';
import { X, Plus, Trash2, CheckCircle, Loader2, Calendar, Eye } from 'lucide-react';
import { createExam, type CreateExamDTO } from '../services/exam.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjectId: number;
  onSuccess: () => void;
}

interface OptionState {
  text: string;
  isCorrect: boolean;
}

interface QuestionState {
  text: string;
  points: number;
  options: OptionState[];
}

const emptyQuestion: QuestionState = {
  text: "",
  points: 1, // Valor por defecto
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false }
  ]
};

export const CreateExamModal = ({ isOpen, onClose, subjectId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  
  // Estados del Formulario
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [dueDate, setDueDate] = useState(""); 
  const [showResults, setShowResults] = useState(false);
  
  const [questions, setQuestions] = useState<QuestionState[]>([{ ...emptyQuestion }]);

  if (!isOpen) return null;

  // --- MANEJADORES DE ESTADO ---
  
  const addQuestion = () => {
    const newQStructure: QuestionState = {
        text: "",
        points: 1,
        options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }]
    };
    setQuestions([...questions, newQStructure]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) return;
    const newQ = [...questions];
    newQ.splice(idx, 1);
    setQuestions(newQ);
  };

  const updateQuestionText = (idx: number, text: string) => {
    const newQ = [...questions];
    newQ[idx].text = text;
    setQuestions(newQ);
  };

  // --- MANEJADORES DE OPCIONES ---

  const addOption = (qIdx: number) => {
    const newQ = [...questions];
    newQ[qIdx].options.push({ text: "", isCorrect: false });
    setQuestions(newQ);
  };

  const updateOptionText = (qIdx: number, oIdx: number, text: string) => {
    const newQ = [...questions];
    newQ[qIdx].options[oIdx].text = text;
    setQuestions(newQ);
  };

  const setCorrectOption = (qIdx: number, oIdx: number) => {
    const newQ = [...questions];
    newQ[qIdx].options.forEach((opt) => opt.isCorrect = false);
    newQ[qIdx].options[oIdx].isCorrect = true;
    setQuestions(newQ);
  };

  // --- ENVIAR AL BACKEND ---

  const handleSubmit = async () => {
    if (!title) return alert("El título es obligatorio");
    
    const isValid = questions.every(q => q.text.trim() !== "" && q.options.every(o => o.text.trim() !== ""));
    if (!isValid) return alert("Por favor completa todos los campos de texto de las preguntas y opciones.");

    setLoading(true);
    try {
      // ✅ FIX: Ya no necesitamos @ts-ignore porque actualizamos CreateExamDTO
      const payload: CreateExamDTO = {
        title,
        description,
        subjectId,
        duration,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        showResults, 
        questions
      };
      
      await createExam(payload);
      onSuccess(); 
      onClose();
      
      // Reset form
      setTitle("");
      setDescription("");
      setDueDate("");
      setShowResults(false);
      setQuestions([{ ...emptyQuestion }]);
    } catch (error) {
      console.error(error);
      alert("Error creando el examen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* HEADER */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800">Crear Nuevo Examen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
        </div>

        {/* BODY SCROLLABLE */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Datos Generales */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título del Examen</label>
                    <input 
                        value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="Ej: Parcial de Matemáticas I"
                    />
                </div>
                
                {/* Duración */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (mins)</label>
                    <input 
                        type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
                        className="w-full border rounded-lg p-2"
                        min="1"
                    />
                </div>

                {/* Fecha Límite */}
                <div>
                    {/* ✅ FIX: Eliminada la clase 'block' que causaba conflicto con 'flex' */}
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Calendar size={14}/> Fecha Límite (Opcional)
                    </label>
                    <input 
                        type="datetime-local" 
                        value={dueDate} 
                        onChange={e => setDueDate(e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm text-gray-600"
                    />
                </div>
            </div>
            
            {/* Descripción */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                <input 
                    value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    placeholder="Instrucciones breves..."
                />
            </div>

            {/* Switch Revisión (Configuración Inicial) */}
            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${showResults ? 'bg-blue-600' : 'bg-gray-300'}`} onClick={() => setShowResults(!showResults)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${showResults ? 'translate-x-4' : ''}`} />
                </div>
                <div>
                    <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                        <Eye size={14}/> Permitir Revisión
                    </span>
                    <p className="text-xs text-gray-500">Si activas esto, los alumnos verán las respuestas correctas al terminar.</p>
                </div>
            </div>
          </div>

          <hr />

          {/* Lista de Preguntas */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                📝 Preguntas ({questions.length})
                </h3>
                <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
                    Total: {questions.reduce((acc, q) => acc + (q.points || 0), 0)} pts
                </span>
            </div>

            {questions.map((q, qIdx) => (
              <div key={qIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group transition-all hover:shadow-md">
                
                <button 
                  onClick={() => removeQuestion(qIdx)}
                  className="absolute -top-3 -right-3 bg-white shadow-sm border border-gray-200 p-2 rounded-full text-gray-400 hover:text-red-500 hover:border-red-200 hover:shadow-md transition z-10"
                  title="Eliminar pregunta"
                >
                  <Trash2 size={16} />
                </button>

                {/* Header Pregunta */}
                <div className="mb-4">
                  <div className="flex gap-4 items-start">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                            Pregunta {qIdx + 1}
                        </label>
                        <input 
                          value={q.text} onChange={e => updateQuestionText(qIdx, e.target.value)}
                          className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none py-1 font-medium text-gray-800 text-lg placeholder-gray-400"
                          placeholder="Texto de la pregunta..."
                        />
                      </div>

                      <div className="w-24 flex flex-col items-center p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                            PUNTOS
                        </label>
                        <input 
                          type="number"
                          min="1"
                          value={q.points} 
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const newQ = [...questions];
                            newQ[qIdx].points = val;
                            setQuestions(newQ);
                          }}
                          className="w-full text-center font-bold text-gray-800 outline-none text-lg"
                        />
                      </div>
                  </div>
                </div>

                {/* Opciones */}
                <div className="space-y-3 pl-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-3 group/option">
                      <button 
                        onClick={() => setCorrectOption(qIdx, oIdx)}
                        className={`p-1 rounded-full transition-all ${opt.isCorrect ? 'text-green-600 bg-green-100 ring-2 ring-green-500 ring-offset-1' : 'text-gray-300 hover:text-gray-400'}`}
                      >
                        <CheckCircle size={22} fill={opt.isCorrect ? "currentColor" : "none"} />
                      </button>
                      
                      <input 
                        value={opt.text} onChange={e => updateOptionText(qIdx, oIdx, e.target.value)}
                        className={`flex-1 text-sm border-b border-transparent focus:border-gray-300 outline-none py-1 transition-colors ${opt.isCorrect ? 'font-medium text-gray-900' : 'text-gray-600'}`}
                        placeholder={`Opción ${oIdx + 1}`}
                      />
                    </div>
                  ))}
                  <button onClick={() => addOption(qIdx)} className="text-xs text-blue-600 hover:text-blue-700 hover:underline ml-10 flex items-center gap-1 font-medium mt-2">
                    <Plus size={14}/> Agregar otra opción
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={addQuestion}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition font-medium flex justify-center items-center gap-2"
          >
            <Plus size={20}/> Agregar Nueva Pregunta
          </button>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition shadow-sm hover:shadow"
          >
            {loading && <Loader2 className="animate-spin" size={18}/>}
            Guardar Examen
          </button>
        </div>

      </div>
    </div>
  );
};