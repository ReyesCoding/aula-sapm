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

// Obtener un examen individual
export const getExamById = async (id: number) => {
  const response = await api.get(`/exams/${id}`);
  return response.data;
};

// Enviar el examen resuelto
export const submitExamResponses = async (data: SubmitExamDTO) => {
  const response = await api.post('/exams/submit', data);
  return response.data; 
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

// 👇 CORRECCIÓN 1: Endpoint correcto (/results)
export const getExamSubmissions = async (examId: number): Promise<ExamSubmissionResult[]> => {
  const response = await api.get(`/exams/${examId}/results`); // Antes: /submissions
  return response.data;
};

// 👇 CORRECCIÓN 2: Endpoint correcto (/toggle)
export const toggleExamResults = async (examId: number) => {
  const response = await api.patch(`/exams/${examId}/toggle`); // Antes: /toggle-visibility
  return response.data; 
};