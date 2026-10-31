const marks = {
  Active: 'bg-plum',
  Paid: 'bg-settled',
  Overdue: 'bg-alarm',
  Confirmed: 'bg-ink',
  Quotation: 'border border-ink',
  Draft: 'border border-faint',
  Paused: 'bg-faint',
  Closed: 'bg-line',
  Cancelled: 'bg-line',
  Archived: 'bg-line',
  Off: 'border border-faint',
  On: 'bg-plum',
};

export function StatusTag({ status }) {
  return (
    <span className={`inline-flex items-center gap-2 text-caption font-medium whitespace-nowrap ${status === 'Overdue' ? 'text-alarm' : ''}`}>
      <span aria-hidden className={`size-2 shrink-0 ${marks[status] || 'bg-faint'}`} />
      {status}
    </span>
  );
}
