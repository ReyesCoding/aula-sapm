import api from './api';

export interface Assignment {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  status: 'PENDING' | 'SUBMITTED' | 'LATE' | 'GRADED';
  grade?: number;
  attachmentUrl?: string | null;
  submissionUrl?: string | null;
  submissionComment?: string | null;
  feedback?: string | null;
  subject: {
    id: number;
    name: string;
  };
  student?: {
    id: number;
    name: string;
    email: string;
  };
}

// Interfaz para los datos de creación
interface CreateAssignmentData {
  title: string;
  description: string;
  dueDate: string;
  subjectId: number;
  studentId?: number; // Opcional (si es individual)
  courseId?: number | string;  // Opcional (si es grupal)
}

export const getAssignments = async (): Promise<Assignment[]> => {
  const { data } = await api.get<Assignment[]>('/assignments');
  return data;
};

// 👇 ESTA ES LA FUNCIÓN QUE USA EL MODAL
export const createAssignment = async (assignmentData: CreateAssignmentData, file: File | null) => {
  const formData = new FormData();
  
  // Agregar campos de texto
  formData.append('title', assignmentData.title);
  formData.append('description', assignmentData.description);
  formData.append('dueDate', assignmentData.dueDate);
  formData.append('subjectId', String(assignmentData.subjectId));

  // Lógica inteligente: O mandamos studentId O mandamos courseId
  if (assignmentData.courseId) {
    formData.append('courseId', String(assignmentData.courseId));
  } else if (assignmentData.studentId) {
    formData.append('studentId', String(assignmentData.studentId));
  }

  // Agregar archivo si existe
  if (file) {
    formData.append('file', file);
  }

  // Importante: Al enviar FormData, no ponemos Content-Type manual, Axios lo hace solo
  const { data } = await api.post('/assignments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const submitAssignment = async (id: number, file: File, comment?: string) => {
  const formData = new FormData();
  
  formData.append('file', file);
  
  // Solo agregamos el comentario si existe
  if (comment) {
    formData.append('comment', comment);
  }

  const response = await api.post(`/assignments/${id}/submit`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data', // 👈 Vital para archivos
    },
  });

  return response.data;
};

export const gradeAssignment = async (id: number, grade: number, feedback: string): Promise<void> => {
  await api.patch(`/assignments/${id}/grade`, { grade, feedback });
};

export const deleteAssignment = async (id: number) => {
  await api.delete(`/assignments/${id}`);
};

// Helper por si necesitas subir archivos sueltos (opcional)
export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/upload', formData);
    return data;
};

// 👇 Función para Editar
export const updateAssignment = async (id: number, data: { title: string, description: string, dueDate: string }, file: File | null) => {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('description', data.description);
  formData.append('dueDate', data.dueDate);
  
  if (file) {
    formData.append('file', file);
  }

  const { data: response } = await api.patch(`/assignments/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response;
};

export const getAssignmentsBySubject = async (subjectId: number) => {
  // Pasamos el ID como query param ?subjectId=1
  const response = await api.get(`/assignments?subjectId=${subjectId}`);
  return response.data;
};