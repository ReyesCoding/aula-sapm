export interface Assignment {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  status: 'PENDING' | 'SUBMITTED' | 'LATE' | 'GRADED';
  grade?: number;
  
  // 👇 AGREGA ESTOS 3 CAMPOS NUEVOS
  attachmentUrl?: string | null;    // Archivo del profe
  submissionUrl?: string | null;    // Archivo del alumno
  submissionComment?: string | null; // Comentario del alumno

  // 👇 AGREGAR
  feedback?: string | null; // Comentario del profe al calificar

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