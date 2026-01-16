import { useState } from 'react';
import { X, Plus, Trash2, CheckCircle, Loader2 } from 'lucide-react'; // 1. Eliminado 'Save'
import { createExam, type CreateExamDTO } from '../services/exam.service'; // 2. Agregado 'type'

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjectId: number;
  onSuccess: () => void;
}

// 3. Interfaces Locales para eliminar los 'any'
interface OptionState {
  text: string;
  isCorrect: boolean;
}

interface QuestionState {
  text: string;
  points: number;
  options: OptionState[];
}

// Estado inicial tipado
const emptyQuestion: QuestionState = {
  text: "",
  points: 1,
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false }
  ]
};

export const CreateExamModal = ({ isOpen, onClose, subjectId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  
  // 4. Estado fuertemente tipado (Adiós 'any')
  const [questions, setQuestions] = useState<QuestionState[]>([{ ...emptyQuestion }]);

  if (!isOpen) return null;

  // --- MANEJADORES DE ESTADO ---
  
  const addQuestion = () => {
    // Clonamos deep para evitar referencias compartidas
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
    // Resetear todas las opciones de esta pregunta a false
    newQ[qIdx].options.forEach((opt) => opt.isCorrect = false);
    // Marcar la seleccionada
    newQ[qIdx].options[oIdx].isCorrect = true;
    setQuestions(newQ);
  };

  // --- ENVIAR AL BACKEND ---

  const handleSubmit = async () => {
    if (!title) return alert("El título es obligatorio");
    
    // Validación extra: Verificar que las preguntas tengan texto
    const isValid = questions.every(q => q.text.trim() !== "" && q.options.every(o => o.text.trim() !== ""));
    if (!isValid) return alert("Por favor completa todos los campos de texto de las preguntas y opciones.");

    setLoading(true);
    try {
      const payload: CreateExamDTO = {
        title,
        description,
        subjectId,
        duration,
        questions
      };
      
      await createExam(payload);
      onSuccess(); 
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título del Examen</label>
                    <input 
                        value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="Ej: Parcial de Matemáticas I"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (mins)</label>
                    <input 
                        type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
                        className="w-full border rounded-lg p-2"
                    />
                </div>
            </div>
            
            {/* 5. Agregado el campo Descripción para usar la variable setDescription */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                <input 
                    value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    placeholder="Instrucciones breves para el estudiante..."
                />
            </div>
          </div>

          <hr />

          {/* Lista de Preguntas */}
          <div className="space-y-6">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
               📝 Preguntas ({questions.length})
            </h3>

            {questions.map((q, qIdx) => (
              <div key={qIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group">
                <button 
                  onClick={() => removeQuestion(qIdx)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                  title="Eliminar pregunta"
                >
                  <Trash2 size={18} />
                </button>

                <div className="mb-3 pr-8">
                  <label className="text-xs font-bold text-gray-500 uppercase">Pregunta {qIdx + 1}</label>
                  <input 
                    value={q.text} onChange={e => updateQuestionText(qIdx, e.target.value)}
                    className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none py-1 font-medium text-gray-800"
                    placeholder="Escribe la pregunta aquí..."
                  />
                </div>

                <div className="space-y-2 ml-4">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-3">
                      <button 
                        onClick={() => setCorrectOption(qIdx, oIdx)}
                        className={`p-1 rounded-full transition ${opt.isCorrect ? 'text-green-600 bg-green-100' : 'text-gray-300 hover:text-gray-400'}`}
                        title="Marcar como correcta"
                      >
                        <CheckCircle size={20} fill={opt.isCorrect ? "currentColor" : "none"} />
                      </button>
                      
                      <input 
                        value={opt.text} onChange={e => updateOptionText(qIdx, oIdx, e.target.value)}
                        className={`flex-1 text-sm border-b border-transparent focus:border-gray-300 outline-none py-1 ${opt.isCorrect ? 'font-bold text-green-700' : 'text-gray-600'}`}
                        placeholder={`Opción ${oIdx + 1}`}
                      />
                    </div>
                  ))}
                  <button onClick={() => addOption(qIdx)} className="text-xs text-blue-500 hover:underline ml-9 flex items-center gap-1">
                    <Plus size={12}/> Agregar opción
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={addQuestion}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-600 transition font-medium flex justify-center items-center gap-2"
          >
            <Plus size={20}/> Agregar Nueva Pregunta
          </button>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="animate-spin" size={18}/>}
            Guardar Examen
          </button>
        </div>

      </div>
    </div>
  );
};