import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Loader2, Paperclip, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getConversations,
  getConversation,
  sendMessage,
  markConversationRead,
  type ConversationSummary,
  type ConversationDetail,
} from '../services/messaging.service';
import { NewConversationModal } from '../components/NewConversationModal';

const roleLabel: Record<string, string> = {
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
  PARENT: 'Padre/Madre',
  CENTRO: 'Centro',
  ADMIN: 'Admin',
};

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const [draft, setDraft] = useState('');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = useCallback(async (conversationId: number) => {
    setSelectedId(conversationId);
    setLoadingDetail(true);
    try {
      const data = await getConversation(conversationId);
      setDetail(data);
      await markConversationRead(conversationId);
      setConversations((prev) => prev.map((c) => (c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c)));
    } catch (error) {
      console.error('Error cargando conversación:', error);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || (!draft.trim() && !draftFile)) return;
    try {
      setSending(true);
      await sendMessage(selectedId, draft.trim(), draftFile);
      setDraft('');
      setDraftFile(null);
      await openConversation(selectedId);
      await loadConversations();
    } catch {
      alert('Error al enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleCreated = async (conversationId: number) => {
    await loadConversations();
    await openConversation(conversationId);
  };

  const conversationTitle = (c: ConversationSummary | ConversationDetail['conversation']) => {
    const others = c.participants.filter((p) => p.id !== user?.id);
    if (c.subject) return c.subject;
    return others.map((p) => p.name).join(', ') || 'Conversación';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-violet-600 mb-6 transition">
          <ArrowLeft size={20} className="mr-2" /> Volver al Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex h-[70vh]">
          {/* LISTA DE CONVERSACIONES */}
          <div className="w-full sm:w-80 border-r border-gray-100 flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">Mensajes</h2>
              <button
                onClick={() => setIsNewOpen(true)}
                className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-violet-700 transition"
              >
                <Plus size={14} /> Nuevo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingList ? (
                <div className="text-center py-10"><Loader2 className="animate-spin text-violet-600 mx-auto" /></div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm px-4">
                  No tienes conversaciones. Empieza una con el botón "Nuevo".
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.conversationId}
                    onClick={() => openConversation(c.conversationId)}
                    className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition ${
                      selectedId === c.conversationId ? 'bg-violet-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-gray-800 text-sm truncate">{conversationTitle(c)}</p>
                      {c.unreadCount > 0 && (
                        <span className="bg-violet-600 text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center shrink-0">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">{c.lastMessage?.body || 'Sin mensajes aún'}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* CONVERSACIÓN ACTIVA */}
          <div className="hidden sm:flex flex-1 flex-col">
            {!selectedId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                <MessageSquare size={40} />
                <p className="text-sm">Selecciona una conversación para verla aquí.</p>
              </div>
            ) : loadingDetail || !detail ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-violet-600" /></div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100">
                  <p className="font-bold text-gray-800">{conversationTitle(detail.conversation)}</p>
                  <p className="text-xs text-gray-400">
                    {detail.conversation.participants.filter((p) => p.id !== user?.id).map((p) => roleLabel[p.role] || p.role).join(', ')}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                  {detail.messages.map((m) => {
                    const isMine = m.senderId === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-sm rounded-xl px-4 py-2.5 ${isMine ? 'bg-violet-600 text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>
                          {m.body && <p className="text-sm whitespace-pre-wrap">{m.body}</p>}
                          {m.attachments.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {m.attachments.map((a) => (
                                <a key={a.id} href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer"
                                  className={`flex items-center gap-1.5 text-xs underline ${isMine ? 'text-violet-100' : 'text-violet-600'}`}>
                                  <Paperclip size={12} /> {a.originalName}
                                </a>
                              ))}
                            </div>
                          )}
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-violet-200' : 'text-gray-400'}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white">
                  {draftFile && (
                    <div className="mb-2 flex items-center gap-2 text-xs bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg w-fit">
                      <Paperclip size={12} /> {draftFile.name}
                      <button type="button" onClick={() => setDraftFile(null)} className="hover:text-violet-900"><X size={12} /></button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer transition shrink-0">
                      <Paperclip size={18} />
                      <input type="file" className="hidden" onChange={(e) => setDraftFile(e.target.files?.[0] || null)} />
                    </label>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
                    />
                    <button type="submit" disabled={sending || (!draft.trim() && !draftFile)}
                      className="bg-violet-600 text-white px-4 py-2.5 rounded-lg hover:bg-violet-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2 shrink-0">
                      {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <NewConversationModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
