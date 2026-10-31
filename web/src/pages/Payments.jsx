import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLookups, useWorkspace } from '../lib/api.js';
import { formatDate, isoToday, monthLongLabel, money } from '../lib/format.js';
import { DataTable } from '../components/DataTable.jsx';
import { Loading, PageHeader, SearchInput, Stat, Toolbar } from '../components/Layout.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { PAYMENT_METHODS } from './invoices/InvoiceDrawer.jsx';

export default function Payments() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const navigate = useNavigate();
  const [method, setMethod] = useState('all');
  const [query, setQuery] = useState('');
  const today = isoToday();

  const rows = useMemo(() => {
    if (!lookups) return [];
    const needle = query.trim().toLowerCase();
    return data.payments
      .map((payment) => { const invoice = lookups.invoices.get(payment.invoiceId); return { ...payment, invoice, customer: invoice?.customer }; })
      .filter((row) => (method === 'all' || row.method === method) && (!needle || [row.invoice?.number, row.customer?.company, row.customer?.name, row.note].some((value) => value?.toLowerCase().includes(needle))))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, lookups, method, query]);

  if (isLoading || !lookups) return <Loading />;
  const sum = (list) => list.reduce((total, payment) => total + payment.amount, 0);
  const thisMonth = sum(data.payments.filter((payment) => payment.date.startsWith(today.slice(0, 7))));
  const thisYear = sum(data.payments.filter((payment) => payment.date.startsWith(today.slice(0, 4))));
  const counts = Object.fromEntries(PAYMENT_METHODS.map(([value]) => [value, data.payments.filter((payment) => payment.method === value).length]));

  const columns = [
    { key: 'date', header: 'Received', render: (row) => <span className="tabular-nums">{formatDate(row.date)}</span> },
    { key: 'invoice', header: 'Invoice', render: (row) => <span className="font-semibold tabular-nums">{row.invoice?.number || 'Removed invoice'}</span> },
    { key: 'customer', header: 'Customer', render: (row) => <span className="font-medium">{row.customer?.company || row.customer?.name}</span> },
    { key: 'method', header: 'Method', render: (row) => <span className="capitalize">{row.method}</span> },
    { key: 'note', header: 'Note', render: (row) => <span className="text-mute">{row.note || '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <span className="font-semibold tabular-nums">{money(row.amount)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Payments" description="Money received, each matched to the invoice it paid. Record new payments from the invoice itself." />
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 py-8 sm:grid-cols-3">
        <Stat label={`Collected in ${monthLongLabel(today.slice(0, 7))}`} value={money(thisMonth)} />
        <Stat label={`Collected in ${today.slice(0, 4)}`} value={money(thisYear)} />
        <Stat label="Payments recorded" value={data.payments.length} note="Across every invoice" />
      </div>
      <Tabs label="Filter by method" value={method} onChange={setMethod} items={[{ value: 'all', label: 'All methods', count: data.payments.length }, ...PAYMENT_METHODS.filter(([value]) => counts[value]).map(([value, label]) => ({ value, label, count: counts[value] }))]} />
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search invoice, customer or note" />
        <span className="text-body text-mute"><span className="font-semibold text-ink tabular-nums">{money(sum(rows))}</span> in {rows.length} payments</span>
      </Toolbar>
      <DataTable columns={columns} rows={rows} onRowClick={(row) => row.invoice && navigate(`/invoices?view=${row.invoice.id}`)} empty="No payments match these filters." />
    </div>
  );
}
