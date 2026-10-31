export const SUBSCRIPTION_STEPS = ['Draft', 'Quotation', 'Confirmed', 'Active', 'Closed'];
export const INVOICE_STEPS = ['Draft', 'Confirmed', 'Paid'];

// Numbered progress through a record's lifecycle; off-path states (Paused, Overdue) are passed as `note`.
export function Lifecycle({ steps, current, note }) {
  const position = steps.indexOf(current);
  return (
    <div>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const reached = position >= 0 && index <= position;
          const isCurrent = index === position;
          return (
            <li key={step} aria-current={isCurrent ? 'step' : undefined} className="pr-2">
              <span className={`block h-1 ${reached ? 'bg-plum' : 'bg-line'}`} />
              <span className={`mt-2.5 block text-caption tabular-nums ${isCurrent ? 'text-plum' : 'text-faint'}`}>{String(index + 1).padStart(2, '0')}</span>
              <span className={`block text-body font-medium ${isCurrent ? 'text-ink' : reached ? 'text-mute' : 'text-faint'}`}>{step}</span>
            </li>
          );
        })}
      </ol>
      {note && <p className="mt-3 text-body text-mute">{note}</p>}
    </div>
  );
}
