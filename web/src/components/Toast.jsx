import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, tone = 'info') => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 px-4">
        {toast && (
          <div key={toast.key} className={`animate-toast flex items-center gap-3 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_32px_-12px_rgba(14,14,14,0.5)] ${toast.tone === 'error' ? 'bg-alarm' : 'bg-ink'}`}>
            <span className={`size-2 ${toast.tone === 'error' ? 'bg-white' : 'bg-plum'}`} />
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
