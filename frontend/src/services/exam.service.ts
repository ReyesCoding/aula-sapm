// ❌ Borramos esta línea: import axios from 'axios';
// ✅ Usamos ÚNICAMENTE la instancia configurada
import api from './api';

export interface ExamSummary {
  id: number;
  title: string;
  dueDate: string | null; 
  showResults: boolean;   
  subject?: { name: string };
  isSubmitted: boolean; 
  score: number | null; 
  _count: { questions: number };
}

export const getExamsBySubject = async (subjectId: number): Promise<ExamSummary[]> => {
  const response = await api.get(`/exams/subject/${subjectId}`);
  return response.data;
};

// Tipos para la creación
export interface CreateExamDTO {
  title: string;
  description?: string;
  subjectId: number;
  duration?: number;
  dueDate?: string;       
  showResults?: boolean;  
  // -----------------------
  questions: {
    text: string;
    points: number;
    options: {
      text: string;
      isCorrect: boolean;
    }[];
  }[];
}

export const createExam = async (examData: CreateExamDTO) => {
  const response = await api.post('/exams', examData);
  return response.data;
};

// Tipo para enviar respuestas
export interface SubmitExamDTO {
  examId: number;
  answers: {
    questionId: number;
    selectedOptionId: number;
  }[];
}

// Obtener un examen individual por ID (para que el alumno lo vea)
export const getExamById = async (id: number) => {
  const response = await api.get(`/exams/${id}`);
  return response.data;
};

// Enviar el examen resuelto
export const submitExamResponses = async (data: SubmitExamDTO) => {
  const response = await api.post('/exams/submit', data);
  return response.data; // El backend nos devolverá la nota (score)
};

// 👇 Interfaces para los resultados
export interface ExamSubmissionResult {
  id: number;
  score: number;
  student: {
    id: number;
    name: string;
    email: string;
  };
  submittedAt?: string; 
}

// 👇 Función para obtener los resultados de un examen (Solo Profesor)
export const getExamSubmissions = async (examId: number): Promise<ExamSubmissionResult[]> => {
  // ✅ CORREGIDO: Usamos 'api' en lugar de 'axios'
  const response = await api.get(`/exams/${examId}/submissions`);
  return response.data;
};

export const toggleExamResults = async (examId: number) => {
  // ✅ CORREGIDO: Usamos 'api' en lugar de 'axios'
  const response = await api.patch(`/exams/${examId}/toggle-visibility`);
  return response.data; // { showResults: boolean }
};