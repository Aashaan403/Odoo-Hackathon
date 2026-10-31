const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export const money = (value) => currency.format(Number(value || 0));
export const wholeMoney = (value) => wholeCurrency.format(Number(value || 0));
export const compactMoney = (value) => compact.format(Number(value || 0));

export const formatDate = (value) => (value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const longToday = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const isoToday = () => new Date().toLocaleDateString('en-CA');
export const addDaysIso = (iso, days) => { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + days); return date.toLocaleDateString('en-CA'); };
export const daysBetween = (fromIso, toIso) => Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / 86400000);

export const monthLabel = (key) => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short' });
export const monthLongLabel = (key) => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
export const capitalize = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);
export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const intervalLabel = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

export function downloadCsv(filename, rows, columns) {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [columns.map(([, label]) => escape(label)).join(','), ...rows.map((row) => columns.map(([key]) => escape(row[key])).join(','))].join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
