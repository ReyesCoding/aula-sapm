import { useEffect, useState } from 'react';
import { X, Send, Loader2, AlertCircle } from 'lucide-react';
import { getContacts, createConversation, type MessagingContact } from '../services/messaging.service';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conversationId: number) => void;
}

const roleLabel: Record<string, string> = {
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
  PARENT: 'Padre/Madre',
  CENTRO: 'Centro',
  ADMIN: 'Admin',
};

export const NewConversationModal = ({ isOpen, onClose, onCreated }: NewConversationModalProps) => {
  const [contacts, setContacts] = useState<MessagingContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactId, setContactId] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingContacts(true);
    setError(null);
    getContacts()
      .then(setContacts)
      .catch(() => setError('No se pudo cargar la lista de contactos.'))
      .finally(() => setLoadingContacts(false));
  }, [isOpen]);

  const resetAndClose = () => {
    setContactId('');
    setMessage('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) {
      setError('Selecciona a quién le quieres escribir.');
      return;
    }
    if (!message.trim()) {
      setError('Escribe un mensaje.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const result = await createConversation([Number(contactId)], message.trim());
      const conversationId = 'conversationId' in result ? result.conversationId : result.id;
      onCreated(conversationId);
      resetAndClose();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al crear la conversación.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        <div className="bg-violet-600 px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <h3 className="font-bold text-lg">Nuevo Mensaje</h3>
          <button onClick={resetAndClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Para</label>
            {loadingContacts ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <Loader2 className="animate-spin" size={16} /> Cargando contactos...
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tienes contactos disponibles todavía.</p>
            ) : (
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
              >
                <option value="">Selecciona un contacto...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({roleLabel[c.role] || c.role})</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Mensaje</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none resize-none text-sm"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={resetAndClose} disabled={submitting}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || loadingContacts}
              className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
