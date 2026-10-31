import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, useLookups, useWorkspace } from '../lib/api.js';
import { downloadCsv, formatDate, isoToday, money, monthLabel } from '../lib/format.js';
import { Button } from '../components/Button.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Field, Input, Select } from '../components/Field.jsx';
import { Loading, PageHeader, Section, Stat } from '../components/Layout.jsx';
import { StatusTag } from '../components/StatusTag.jsx';
import { StepChart } from '../components/StepChart.jsx';

const yearStart = () => `${isoToday().slice(0, 4)}-01-01`;

function monthsBetween(from, to) {
  const keys = [];
  const cursor = new Date(`${from.slice(0, 7)}-01T12:00:00`);
  const end = to.slice(0, 7);
  while (keys.length < 36) {
    const key = cursor.toLocaleDateString('en-CA').slice(0, 7);
    keys.push(key);
    if (key >= end) break;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export default function Reports() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ from: yearStart(), to: isoToday(), planId: '', customerId: '', status: '' });
  const set = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });
  const report = useQuery({ queryKey: ['report', filters.from, filters.to], queryFn: () => api(`/reports?from=${filters.from}&to=${filters.to}`), placeholderData: keepPreviousData });

  const view = useMemo(() => {
    if (!report.data || !lookups) return null;
    const invoices = report.data.invoices
      .map((invoice) => { const subscription = lookups.subscriptions.get(invoice.subscriptionId); return { ...invoice, customer: lookups.customers.get(invoice.customerId), planId: subscription?.planId, plan: lookups.plans.get(subscription?.planId) }; })
      .filter((invoice) => (!filters.planId || invoice.planId === filters.planId) && (!filters.customerId || invoice.customerId === filters.customerId) && (!filters.status || invoice.status === filters.status))
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
    const billed = sum(invoices, 'total');
    const outstanding = sum(invoices, 'outstanding');
    const overdue = sum(invoices.filter((invoice) => invoice.status === 'Overdue'), 'outstanding');
    const months = monthsBetween(filters.from, filters.to);
    const perMonth = Object.fromEntries(months.map((key) => [key, 0]));
    for (const invoice of invoices) if (invoice.issueDate.slice(0, 7) in perMonth) perMonth[invoice.issueDate.slice(0, 7)] += invoice.total;
    const byPlan = data.plans.map((plan) => ({ plan, total: sum(invoices.filter((invoice) => invoice.planId === plan.id), 'total') })).filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
    return { invoices, billed, collected: billed - outstanding, outstanding, overdue, chart: months.map((key) => ({ key, label: monthLabel(key), value: perMonth[key] })), byPlan };
  }, [report.data, lookups, filters, data]);

  if (isLoading || !lookups || !view) return <Loading label="Building the report" />;
  const staff = data.user.role !== 'customer';
  const largest = view.byPlan[0]?.total || 1;

  const columns = [
    { key: 'number', header: 'Invoice', render: (row) => <span className="font-semibold tabular-nums">{row.number}</span> },
    staff && { key: 'customer', header: 'Customer', render: (row) => row.customer?.company || row.customer?.name },
    { key: 'plan', header: 'Plan', render: (row) => <span className="text-mute">{row.plan?.name || '—'}</span> },
    { key: 'issued', header: 'Issued', render: (row) => <span className="tabular-nums">{formatDate(row.issueDate)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusTag status={row.status} /> },
    { key: 'total', header: 'Total', align: 'right', render: (row) => <span className="tabular-nums">{money(row.total)}</span> },
    { key: 'balance', header: 'Balance due', align: 'right', render: (row) => <span className="font-semibold tabular-nums">{money(row.outstanding)}</span> },
  ].filter(Boolean);

  const exportCsv = () => downloadCsv(`brightloop-report-${filters.from}-to-${filters.to}.csv`, view.invoices.map((row) => ({ ...row, customerName: row.customer?.company || row.customer?.name, planName: row.plan?.name })), [['number', 'Invoice'], ['customerName', 'Customer'], ['planName', 'Plan'], ['issueDate', 'Issued'], ['dueDate', 'Due'], ['status', 'Status'], ['total', 'Total'], ['outstanding', 'Balance due']]);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader title="Reports" description="Recurring revenue, what was billed and collected, and what is still owed. Every figure follows the filters." actions={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>} />

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-line pb-8 lg:grid-cols-5">
        <Field label="Issued from"><Input type="date" value={filters.from} max={filters.to} onChange={set('from')} /></Field>
        <Field label="Issued until"><Input type="date" value={filters.to} min={filters.from} onChange={set('to')} /></Field>
        <Field label="Plan"><Select value={filters.planId} onChange={set('planId')}><option value="">All plans</option>{data.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select></Field>
        {staff && <Field label="Customer"><Select value={filters.customerId} onChange={set('customerId')}><option value="">All customers</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company || customer.name}</option>)}</Select></Field>}
        <Field label="Invoice status"><Select value={filters.status} onChange={set('status')}><option value="">Any status</option>{['Draft', 'Confirmed', 'Overdue', 'Paid'].map((status) => <option key={status}>{status}</option>)}</Select></Field>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-3">
        <Stat label="Monthly recurring revenue" value={money(report.data.mrr)} note="Today, across all active plans" />
        <Stat label="Active subscriptions" value={report.data.activeSubscriptions} note="Today" />
        <Stat label="Billed" value={money(view.billed)} note={`${view.invoices.length} invoices in range`} />
        <Stat label="Collected" value={money(view.collected)} note={view.billed ? `${Math.round((view.collected / view.billed) * 100)}% of billed` : undefined} />
        <Stat label="Outstanding" value={money(view.outstanding)} note="Billed but not yet paid" />
        <Stat label="Overdue" value={money(view.overdue)} tone={view.overdue ? 'alarm' : undefined} note="Past the due date" />
      </div>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section title="Billed per month">
          <StepChart points={view.chart} height={220} label="Invoice totals per month for the selected range" />
        </Section>
        <Section title="Revenue by plan">
          <ul className="flex flex-col gap-4 border-t border-ink pt-4">
            {view.byPlan.map(({ plan, total }) => (
              <li key={plan.id}>
                <div className="flex justify-between gap-4 text-body"><span className="font-medium">{plan.name}</span><span className="tabular-nums">{money(total)}</span></div>
                <div className="mt-1.5 h-2 bg-mist"><div className="h-full bg-plum" style={{ width: `${Math.max(2, (total / largest) * 100)}%` }} /></div>
                <div className="mt-1 text-caption text-mute">{Math.round((total / (view.billed || 1)) * 100)}% of billed</div>
              </li>
            ))}
            {!view.byPlan.length && <li className="text-body text-mute">Nothing billed in this range.</li>}
          </ul>
        </Section>
      </div>

      <Section title="Invoices in this report" action={<span className="text-mute">{view.invoices.length} rows</span>}>
        <DataTable columns={columns} rows={view.invoices} onRowClick={(row) => navigate(`/invoices?view=${row.id}`)} empty="No invoices match these filters. Widen the date range or clear a filter." />
      </Section>
    </div>
  );
}
