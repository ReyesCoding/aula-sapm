import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// Contexto global y minimalista para saber si la página actual tiene
// cambios sin guardar. Lo usan el botón "Home" (logo) y los botones de
// "volver atrás" para decidir si deben preguntar antes de navegar
// ("¿quieres volver al Home?") o si pueden navegar directo porque no hay
// nada que perder. Cualquier formulario de una página (no de un modal,
// que ya tiene su propio botón Cancelar) puede llamar a setDirty(true)
// cuando el usuario empieza a editar y setDirty(false) al guardar o
// descartar los cambios.
interface DirtyStateContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const DirtyStateContext = createContext<DirtyStateContextValue>({
  isDirty: false,
  setDirty: () => {},
});

export const DirtyStateProvider = ({ children }: { children: ReactNode }) => {
  const [isDirty, setIsDirty] = useState(false);
  const setDirty = useCallback((dirty: boolean) => setIsDirty(dirty), []);
  return (
    <DirtyStateContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </DirtyStateContext.Provider>
  );
};

export const useDirtyState = () => useContext(DirtyStateContext);
