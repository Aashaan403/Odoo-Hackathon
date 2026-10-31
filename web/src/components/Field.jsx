const control = 'h-10 w-full border border-line bg-white px-3 text-sm transition-colors placeholder:text-faint hover:border-faint focus:border-ink focus:outline-none disabled:bg-mist disabled:text-mute';

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </label>
  );
}

export const Input = ({ className = '', ...props }) => <input className={`${control} ${className}`} {...props} />;

export const Textarea = ({ className = '', ...props }) => <textarea className={`${control} h-auto min-h-20 py-2 ${className}`} {...props} />;

export function Select({ className = '', children, ...props }) {
  return (
    <span className="relative block">
      <select className={`${control} appearance-none pr-9 ${className}`} {...props}>{children}</select>
      <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-mute"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </span>
  );
}

// A square switch built on a real checkbox so forms, keyboard and screen readers work unchanged.
export function Toggle({ label, description, className = '', ...props }) {
  return (
    <label className={`group flex cursor-pointer items-start gap-3 py-2 ${className}`}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span aria-hidden className="mt-0.5 flex h-5 w-9 shrink-0 items-center border border-ink bg-white p-[3px] transition-colors peer-checked:border-plum peer-checked:bg-plum peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum">
        <span className="size-3 bg-ink transition-transform duration-150 group-has-checked:translate-x-4 group-has-checked:bg-white" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-mute">{description}</span>}
      </span>
    </label>
  );
}

export function FormGrid({ children, columns = 2 }) {
  return <div className={`grid gap-x-5 gap-y-4 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{children}</div>;
}

export function FormError({ error }) {
  if (!error) return null;
  return <p role="alert" className="border-l-2 border-alarm bg-alarm/5 px-3 py-2 text-sm text-alarm">{error}</p>;
}
