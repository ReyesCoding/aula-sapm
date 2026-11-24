import { useState } from 'react';
import { MessageCircle, AlertTriangle, Lightbulb, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getContacts, createConversation, type MessagingContact } from '../services/messaging.service';
import { InfoDialog } from './InfoDialog';

/**
 * Botón flotante (inferior derecha), montado una sola vez en
 * ProtectedRoute.tsx para que aparezca en TODAS las páginas protegidas,
 * de todos los roles.
 *
 * Pedido explícito de producto: además de ir a Mensajes, debe permitir
 * "reportar problemas con la web" y "enviar sugerencias (padres a
 * profesores o al centro)". Decisión de diseño (senior call): en vez de
 * crear un sistema de tickets paralelo, esto reutiliza la mensajería ya
 * existente (createConversation + messaging.policy.ts), que ya resuelve
 * correctamente "a quién puede escribirle cada rol" — un reporte de
 * problema es, ni más ni menos, un mensaje con una etiqueta y un
 * destinatario sugerido según la cadena de mando ya definida (cualquier
 * rol -> su Centro; Centro -> Admin). Así no se duplica lógica de acceso
 * ni aparece un buzón nuevo que el usuario tenga que aprender a revisar
 * por separado: la respuesta llega a la misma bandeja de Mensajes.
 */
export const FloatingActionButton = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<null | 'report' | 'suggestion'>(null);
  const [contacts, setContacts] = useState<MessagingContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [targetId, setTargetId] = useState<number | ''>('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  if (!user) return null;

  // Admin es la cima de la cadena de mando dentro de la plataforma: no hay
  // nadie "por encima" a quien reportarle un problema o enviarle una
  // sugerencia desde este botón, así que para ese rol solo se ofrece el
  // acceso directo a Mensajes.
  const canEscalate = user.role !== 'ADMIN';

  const closeMenu = () => setOpen(false);

  const openMode = async (m: 'report' | 'suggestion') => {
    setMode(m);
    closeMenu();
    setError(null);
    setBody('');
    setTargetId('');
    setContacts([]);
    setLoadingContacts(true);
    try {
      const all = await getContacts();
      // Reportar un problema: escala hacia arriba en la cadena de mando
      // (cualquier rol -> su Centro; si quien reporta YA es Centro -> Admin).
      // Sugerencia: pensado sobre todo para Padres -> Profesor/Centro, pero
      // se deja disponible para cualquier rol que tenga ese contacto.
      const relevant =
        m === 'report'
          ? all.filter((c) => c.role === (user.role === 'CENTRO' ? 'ADMIN' : 'CENTRO'))
          : all.filter((c) => c.role === 'TEACHER' || c.role === 'CENTRO');
      setContacts(relevant);
      if (relevant.length === 1) setTargetId(relevant[0].id);
    } catch {
      setError('No se pudo cargar la lista de contactos.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setError('Selecciona a quién va dirigido.');
      return;
    }
    if (!body.trim()) {
      setError('Escribe un mensaje.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const prefix = mode === 'report' ? '🐞 Reporte de problema: ' : '💡 Sugerencia: ';
      await createConversation([Number(targetId)], prefix + body.trim());
      setMode(null);
      setResultOpen(true);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'No se pudo enviar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={() => { closeMenu(); navigate('/messages'); }}
              className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 border border-gray-100 whitespace-nowrap"
            >
              <MessageCircle size={18} className="text-violet-600" /> Mensajes
            </button>
            {canEscalate && (
              <>
                <button
                  onClick={() => openMode('suggestion')}
                  className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 border border-gray-100 whitespace-nowrap"
                >
                  <Lightbulb size={18} className="text-amber-500" /> Enviar sugerencia
                </button>
                <button
                  onClick={() => openMode('report')}
                  className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 border border-gray-100 whitespace-nowrap"
                >
                  <AlertTriangle size={18} className="text-red-500" /> Reportar un problema
                </button>
              </>
            )}
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-14 w-14 rounded-full bg-primary hover:bg-blue-800 text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 shrink-0"
          title="Mensajes y ayuda"
        >
          {open ? <X size={24} /> : <MessageCircle size={24} />}
        </button>
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`px-6 py-4 text-white font-bold flex justify-between items-center ${mode === 'report' ? 'bg-red-600' : 'bg-amber-500'}`}>
              {mode === 'report' ? 'Reportar un problema' : 'Enviar una sugerencia'}
              <button onClick={() => setMode(null)} className="opacity-80 hover:opacity-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{error}</div>}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Para</label>
                {loadingContacts ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-2"><Loader2 className="animate-spin" size={16} /> Cargando contactos...</div>
                ) : contacts.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No hay un destinatario disponible en este momento.</p>
                ) : (
                  <select
                    required
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="">Selecciona...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.role === 'CENTRO' ? 'Centro' : c.role === 'TEACHER' ? 'Profesor' : c.role === 'ADMIN' ? 'Admin' : c.role})</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  {mode === 'report' ? 'Describe el problema' : 'Tu sugerencia'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={mode === 'report' ? 'Ej: El botón de "Guardar" no responde en la pantalla de calificaciones...' : 'Ej: Sería útil poder...'}
                  className="w-full border border-gray-300 rounded-lg p-2 resize-none focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setMode(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || loadingContacts || contacts.length === 0}
                  className="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : null} Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InfoDialog
        isOpen={resultOpen}
        variant="success"
        title="¡Enviado!"
        message="Tu mensaje se envió correctamente. Puedes ver la respuesta en tu bandeja de Mensajes."
        onClose={() => setResultOpen(false)}
      />
    </>
  );
};
