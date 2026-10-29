import { useCallback, useEffect, useState } from 'react';
import { X, Send, Loader2, Pin, Lock, Unlock, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getThread,
  createPost,
  deletePost,
  setThreadLock,
  setThreadPin,
  type ThreadDetail,
} from '../services/forum.service';

interface ThreadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: number | null;
  onThreadUpdated: () => void;
}

export const ThreadDetailModal = ({ isOpen, onClose, threadId, onThreadUpdated }: ThreadDetailModalProps) => {
  const { user } = useAuth();
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const data = await getThread(threadId);
      setDetail(data);
    } catch (error) {
      console.error('Error cargando tema:', error);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (isOpen && threadId) load();
  }, [isOpen, threadId, load]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !reply.trim()) return;
    try {
      setSending(true);
      await createPost(threadId, reply.trim());
      setReply('');
      await load();
    } catch {
      alert('Error al enviar la respuesta.');
    } finally {
      setSending(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    try {
      await deletePost(postId);
      await load();
    } catch {
      alert('Error al eliminar el mensaje.');
    }
  };

  const handleToggleLock = async () => {
    if (!detail) return;
    try {
      await setThreadLock(detail.thread.id, !detail.thread.isLocked);
      await load();
      onThreadUpdated();
    } catch {
      alert('Error al cambiar el estado del tema.');
    }
  };

  const handleTogglePin = async () => {
    if (!detail) return;
    try {
      await setThreadPin(detail.thread.id, !detail.thread.isPinned);
      await load();
      onThreadUpdated();
    } catch {
      alert('Error al fijar/desfijar el tema.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-start text-white rounded-t-xl">
          <div className="flex-1 pr-4">
            <h3 className="font-bold text-lg">{detail?.thread.title || 'Cargando...'}</h3>
            {detail && (
              <p className="text-indigo-100 text-xs mt-0.5">
                {detail.thread.author.name} · {new Date(detail.thread.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detail?.canModerate && (
              <>
                <button onClick={handleTogglePin} title={detail.thread.isPinned ? 'Desfijar' : 'Fijar'}
                  className={`p-1.5 rounded transition-colors ${detail.thread.isPinned ? 'bg-white/30' : 'hover:bg-white/20'}`}>
                  <Pin size={16} />
                </button>
                <button onClick={handleToggleLock} title={detail.thread.isLocked ? 'Abrir tema' : 'Cerrar tema'}
                  className={`p-1.5 rounded transition-colors ${detail.thread.isLocked ? 'bg-white/30' : 'hover:bg-white/20'}`}>
                  {detail.thread.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
              </>
            )}
            <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 space-y-4">
          {loading ? (
            <div className="text-center py-10"><Loader2 className="animate-spin text-indigo-600 mx-auto" /></div>
          ) : detail ? (
            <>
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-gray-700 whitespace-pre-wrap">{detail.thread.body}</p>
              </div>

              <div className="space-y-3">
                {detail.posts.length === 0 ? (
                  <p className="text-center text-gray-400 italic py-4">Aún no hay respuestas.</p>
                ) : (
                  detail.posts.map((post) => {
                    const canDelete = post.authorId === user?.id || detail.canModerate;
                    return (
                      <div key={post.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-gray-800">{post.author.name}
                            <span className="text-xs text-gray-400 font-normal ml-2">
                              {new Date(post.createdAt).toLocaleString()}
                            </span>
                          </p>
                          {canDelete && (
                            <button onClick={() => handleDeletePost(post.id)} className="text-gray-400 hover:text-red-600 transition" title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{post.body}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : null}
        </div>

        {detail?.thread.isLocked ? (
          <div className="p-4 border-t border-gray-100 bg-gray-100 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <Lock size={16} /> Este tema está cerrado, no admite nuevas respuestas.
          </div>
        ) : (
          <form onSubmit={handleReply} className="p-4 border-t border-gray-100 bg-white flex gap-3">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribe una respuesta..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm"
            />
            <button type="submit" disabled={sending || !reply.trim()}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2">
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
