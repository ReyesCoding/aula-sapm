import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDirtyState } from '../context/DirtyStateContext';

/**
 * Navegación "guardada": si la página actual tiene cambios sin guardar
 * (DirtyStateContext), pide confirmación con un ConfirmDialog antes de
 * abandonar la página. Si no hay nada sin guardar, navega directo.
 *
 * Uso:
 *   const { go, isConfirmOpen, confirmGo, cancelGo } = useConfirmedNavigation();
 *   <button onClick={() => go('/dashboard')}>Home</button>
 *   <ConfirmDialog isOpen={isConfirmOpen} onConfirm={confirmGo} onCancel={cancelGo} ... />
 */
export function useConfirmedNavigation() {
  const navigate = useNavigate();
  const { isDirty, setDirty } = useDirtyState();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const go = (path: string) => {
    if (isDirty) {
      setPendingPath(path);
    } else {
      navigate(path);
    }
  };

  const confirmGo = () => {
    if (pendingPath) {
      setDirty(false);
      navigate(pendingPath);
    }
    setPendingPath(null);
  };

  const cancelGo = () => setPendingPath(null);

  return { go, isConfirmOpen: pendingPath !== null, confirmGo, cancelGo };
}
