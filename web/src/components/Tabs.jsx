export function Tabs({ items, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 overflow-x-auto border-b border-line">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`-mb-px border-b-2 py-3 text-body font-medium whitespace-nowrap transition-colors ${active ? 'border-plum text-ink' : 'border-transparent text-mute hover:text-ink'}`}
          >
            {item.label}
            {item.count !== undefined && <span className={`ml-1.5 tabular-nums ${active ? 'text-plum' : 'text-faint'}`}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
