import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Right-hand panel for record details and forms; the list underneath stays in place.
export function Drawer({ open, onClose, title, kicker, children, footer, wide = false }) {
  const closeButton = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="animate-veil no-print absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={`animate-drawer relative flex h-full w-full flex-col border-l border-ink bg-white ${wide ? 'max-w-[780px]' : 'max-w-[620px]'}`}>
        <header className="flex items-start justify-between gap-6 border-b border-line px-6 pt-6 pb-5 sm:px-8">
          <div className="min-w-0">
            {kicker && <div className="text-[13px] text-mute">{kicker}</div>}
            <h2 className="figure mt-1 truncate text-[2rem] leading-none font-extrabold">{title}</h2>
          </div>
          <button ref={closeButton} onClick={onClose} aria-label="Close panel" className="no-print -mt-1 -mr-2 grid size-10 shrink-0 place-items-center text-mute hover:text-ink">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
        {footer && <footer className="no-print flex flex-wrap items-center gap-3 border-t border-line bg-white px-6 py-4 sm:px-8">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
