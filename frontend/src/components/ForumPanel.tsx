import { useCallback, useEffect, useState } from 'react';
import { Plus, Pin, Lock, MessageCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSubjectThreads, type ForumThread } from '../services/forum.service';
import { CreateThreadModal } from './CreateThreadModal';
import { ThreadDetailModal } from './ThreadDetailModal';

interface ForumPanelProps {
  subjectId: number;
}

export const ForumPanel = ({ subjectId }: ForumPanelProps) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubjectThreads(subjectId);
      setThreads(data);
    } catch (error) {
      console.error('Error cargando foros:', error);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  if (loading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="animate-spin text-indigo-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium"
          >
            <Plus size={18} /> Nuevo Tema
          </button>
        </div>
      )}

      {threads.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
          No hay temas de foro todavía.
        </div>
      ) : (
        <div className="grid gap-3">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setSelectedThreadId(thread.id)}
              className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md transition flex justify-between items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {thread.isPinned && <Pin size={14} className="text-indigo-500 shrink-0" />}
                  {thread.isLocked && <Lock size={14} className="text-gray-400 shrink-0" />}
                  <h3 className="font-bold text-gray-800 truncate">{thread.title}</h3>
                </div>
                <p className="text-sm text-gray-500 truncate">{thread.body}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {thread.author.name} · {new Date(thread.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium shrink-0 bg-gray-50 px-3 py-1.5 rounded-lg">
                <MessageCircle size={16} /> {thread._count.posts}
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateThreadModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        subjectId={subjectId}
        onSuccess={loadThreads}
      />

      <ThreadDetailModal
        isOpen={selectedThreadId != null}
        onClose={() => setSelectedThreadId(null)}
        threadId={selectedThreadId}
        onThreadUpdated={loadThreads}
      />
    </div>
  );
};
