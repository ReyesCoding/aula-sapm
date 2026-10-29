import api from './api';

export interface SubjectDocument {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  subjectId: number | null;
  uploadedBy: { id: number; name: string };
  createdAt: string;
}

export const getSubjectMaterials = async (subjectId: number): Promise<SubjectDocument[]> => {
  const { data } = await api.get<SubjectDocument[]>(`/documents/subjects/${subjectId}`);
  return data;
};

export const uploadSubjectMaterial = async (subjectId: number, file: File): Promise<SubjectDocument> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<SubjectDocument>(`/documents/subjects/${subjectId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteDocument = async (id: number): Promise<void> => {
  await api.delete(`/documents/${id}`);
};
