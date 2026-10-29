import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, FileArchive, File as FileIcon, Trash2, Loader2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSubjectMaterials,
  uploadSubjectMaterial,
  deleteDocument,
  type SubjectDocument,
} from '../services/document.service';

interface DocumentsPanelProps {
  subjectId: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-violet-500" />;
  if (mimeType === 'application/pdf') return <FileText size={20} className="text-red-500" />;
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return <FileArchive size={20} className="text-amber-500" />;
  return <FileIcon size={20} className="text-gray-400" />;
}

export const DocumentsPanel = ({ subjectId }: DocumentsPanelProps) => {
  const { user } = useAuth();
  const canManage = user?.role === 'TEACHER' || user?.role === 'CENTRO' || user?.role === 'ADMIN';

  const [documents, setDocuments] = useState<SubjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSubjectMaterials(subjectId);
      setDocuments(data);
    } catch (err) {
      console.error('Error cargando materiales:', err);
      setError('No se pudieron cargar los materiales de esta materia.');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      await uploadSubjectMaterial(subjectId, file);
      await loadDocuments();
    } catch (err) {
      console.error('Error subiendo material:', err);
      setError('No se pudo subir el archivo. Verifica que tengas permiso en esta materia.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este material?')) return;
    try {
      setDeletingId(id);
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Error eliminando material:', err);
      setError('No se pudo eliminar el material.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="animate-spin text-violet-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition shadow-sm font-medium disabled:opacity-50"
          >
            {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            {uploading ? 'Subiendo...' : 'Subir Material'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{error}</div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
          No hay materiales subidos todavía en esta materia.
        </div>
      ) : (
        <div className="grid gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-violet-200 transition"
            >
              <FileTypeIcon mimeType={doc.mimeType} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{doc.originalName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {doc.uploadedBy.name} · {formatSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={`/uploads/${doc.filename}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition shrink-0"
                title="Descargar"
              >
                <Download size={18} />
              </a>
              {canManage && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 disabled:opacity-50"
                  title="Eliminar"
                >
                  {deletingId === doc.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
