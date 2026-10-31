import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiMutation, useLookups, useWorkspace } from '../../lib/api.js';
import { daysBetween, formatDate, isoToday, money, plural } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Loading, PageHeader, SearchInput, Toolbar } from '../../components/Layout.jsx';
import { StatusTag } from '../../components/StatusTag.jsx';
import { Tabs } from '../../components/Tabs.jsx';
import { InvoiceDrawer } from './InvoiceDrawer.jsx';

const STATUSES = ['Draft', 'Confirmed', 'Overdue', 'Paid'];

export default function Invoices() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || 'All');
  const [query, setQuery] = useState('');
  const billing = useApiMutation();
  const today = isoToday();

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.invoices
      .filter((item) => (status === 'All' || item.status === status) && (!needle || [item.number, item.subscription?.number, item.customer?.company, item.customer?.name].some((value) => value?.toLowerCase().includes(needle))))
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  }, [data, status, query]);

  if (isLoading || !lookups) return <Loading />;
  const staff = data.user.role !== 'customer';
  const counts = Object.fromEntries(STATUSES.map((name) => [name, data.invoices.filter((item) => item.status === name).length]));
  const viewing = lookups.invoices.get(params.get('view'));
  const openBalance = rows.reduce((sum, item) => sum + item.outstanding, 0);

  const columns = [
    { key: 'number', header: 'Invoice', render: (row) => <><span className="block font-semibold tabular-nums">{row.number}</span><span className="block text-caption text-mute">{row.subscription?.number}</span></> },
    staff && { key: 'customer', header: 'Customer', render: (row) => <span className="font-medium">{row.customer?.company || row.customer?.name}</span> },
    { key: 'issued', header: 'Issued', render: (row) => <span className="tabular-nums">{formatDate(row.issueDate)}</span> },
    { key: 'due', header: 'Due', render: (row) => <><span className="block tabular-nums">{formatDate(row.dueDate)}</span>{row.status === 'Overdue' && <span className="block text-caption text-alarm">{plural(daysBetween(row.dueDate, today), 'day')} late</span>}</> },
    { key: 'status', header: 'Status', render: (row) => <StatusTag status={row.status} /> },
    { key: 'total', header: 'Total', align: 'right', render: (row) => <span className="tabular-nums">{money(row.total)}</span> },
    { key: 'balance', header: 'Balance due', align: 'right', render: (row) => <span className={`font-semibold tabular-nums ${row.outstanding > 0 ? '' : 'text-faint'}`}>{money(row.outstanding)}</span> },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={staff ? 'Invoices' : 'My invoices'}
        description={staff ? 'Created from subscriptions on each billing date. Confirm, send, print and collect them here.' : 'Every invoice for your subscriptions, with what is paid and what is still due.'}
        actions={staff && <Button variant="secondary" busy={billing.isPending} onClick={() => billing.mutate({ path: '/billing/run', success: (result) => (result.created ? `Billing run created ${plural(result.created, 'invoice')}.` : 'Billing run finished. Nothing was due.') })}>Run billing</Button>}
      />
      <Tabs label="Filter by status" value={status} onChange={setStatus} items={[{ value: 'All', label: 'All', count: data.invoices.length }, ...STATUSES.map((name) => ({ value: name, label: name, count: counts[name] }))]} />
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={staff ? 'Search invoice, subscription or customer' : 'Search invoice number'} />
        <span className="text-body text-mute">{plural(rows.length, 'invoice')} with <span className="font-semibold text-ink tabular-nums">{money(openBalance)}</span> still due</span>
      </Toolbar>
      <DataTable columns={columns} rows={rows} activeId={viewing?.id} onRowClick={(row) => setParams({ view: row.id })} empty={query ? 'No invoices match that search.' : 'No invoices in this state.'} />
      {viewing && <InvoiceDrawer invoice={viewing} data={data} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}
