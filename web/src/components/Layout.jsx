export function PageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b-2 border-ink pb-6">
      <div className="min-w-0 max-w-[65ch]">
        <h1 className="figure text-page font-extrabold">{title}</h1>
        {description && <p className="mt-3 text-lead text-mute">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, note, tone }) {
  return (
    <div className="min-w-0 border-t border-line pt-4">
      <div className="text-caption text-mute">{label}</div>
      <div className={`figure mt-1 truncate text-figure font-bold ${tone === 'alarm' ? 'text-alarm' : ''}`}>{value}</div>
      {note && <div className="mt-1 text-caption text-mute">{note}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-title font-semibold tracking-tight">{title}</h2>}
          {action && <div className="text-body">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function DetailList({ items, columns = 3 }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-5 ${columns === 3 ? 'sm:grid-cols-3' : ''}`}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-caption text-mute">{label}</dt>
          <dd className="mt-1 truncate text-body font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Totals({ rows }) {
  return (
    <dl className="ml-auto w-full max-w-xs text-body">
      {rows.filter(Boolean).map(([label, value, strong]) => (
        <div key={label} className={`flex justify-between gap-6 py-1.5 tabular-nums ${strong ? 'mt-2 border-t border-ink pt-3 text-lead font-bold' : ''}`}>
          <dt className={strong ? '' : 'text-mute'}>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full border border-line bg-white pr-3 pl-9 text-body placeholder:text-faint hover:border-faint focus:border-ink focus:outline-none" />
    </label>
  );
}

// Filter row that sits between a page header and its table.
export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 py-5">{children}</div>;
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-body text-mute" role="status">
      <span className="size-2 animate-pulse bg-plum" />
      {label}
    </div>
  );
}
