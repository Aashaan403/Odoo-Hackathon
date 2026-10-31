import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { lineTotal, useLookups, useWorkspace } from '../../lib/api.js';
import { formatDate, intervalLabel, money } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Loading, PageHeader, SearchInput, Toolbar } from '../../components/Layout.jsx';
import { StatusTag } from '../../components/StatusTag.jsx';
import { Tabs } from '../../components/Tabs.jsx';
import { SubscriptionDrawer } from './SubscriptionDrawer.jsx';
import { SubscriptionForm } from './SubscriptionForm.jsx';

const STATUSES = ['Draft', 'Quotation', 'Confirmed', 'Active', 'Paused', 'Closed'];

export default function Subscriptions() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || 'All');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.subscriptions.filter((item) => (status === 'All' || item.status === status) && (!needle || [item.number, item.customer?.company, item.customer?.name, item.plan?.name].some((value) => value?.toLowerCase().includes(needle))));
  }, [data, status, query]);

  if (isLoading || !lookups) return <Loading />;
  const staff = data.user.role !== 'customer';
  const counts = Object.fromEntries(STATUSES.map((name) => [name, data.subscriptions.filter((item) => item.status === name).length]));
  const viewing = lookups.subscriptions.get(params.get('view'));
  const close = () => setParams({}, { replace: true });

  const columns = [
    { key: 'number', header: 'Subscription', render: (row) => <><span className="block font-semibold tabular-nums">{row.number}</span><span className="block text-caption text-mute">Since {formatDate(row.startDate)}</span></> },
    staff && { key: 'customer', header: 'Customer', render: (row) => <><span className="block font-medium">{row.customer?.company || row.customer?.name}</span><span className="block text-caption text-mute">{row.customer?.name}</span></> },
    { key: 'plan', header: 'Plan', render: (row) => <><span className="block">{row.plan?.name}</span><span className="block text-caption text-mute">Billed every {intervalLabel[row.plan?.interval]}</span></> },
    { key: 'status', header: 'Status', render: (row) => <StatusTag status={row.status} /> },
    { key: 'next', header: 'Next invoice', render: (row) => <span className="tabular-nums">{row.status === 'Active' ? formatDate(row.nextBillingDate) : '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <><span className="block font-medium tabular-nums">{money(lineTotal(row.lines))}</span><span className="block text-caption text-mute">per {intervalLabel[row.plan?.interval]}</span></> },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={staff ? 'Subscriptions' : 'My subscriptions'}
        description={staff ? 'Every customer plan from draft to closed. Select one to see its lines, invoices and next steps.' : 'Your plans with Brightloop. Pause, close or renew them here when your plan allows it.'}
        actions={<Button onClick={() => setParams({ new: '1' })}>{staff ? 'New subscription' : 'Add a subscription'}</Button>}
      />
      <Tabs label="Filter by status" value={status} onChange={setStatus} items={[{ value: 'All', label: 'All', count: data.subscriptions.length }, ...STATUSES.filter((name) => staff || counts[name]).map((name) => ({ value: name, label: name, count: counts[name] }))]} />
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder={staff ? 'Search number, customer or plan' : 'Search number or plan'} />
        <span className="text-body text-mute tabular-nums">{rows.length} shown</span>
      </Toolbar>
      <DataTable columns={columns} rows={rows} activeId={viewing?.id} onRowClick={(row) => setParams({ view: row.id })} empty={query ? 'No subscriptions match that search.' : 'No subscriptions in this state.'} />

      {viewing && <SubscriptionDrawer subscription={viewing} data={data} lookups={lookups} onClose={close} />}
      {params.get('new') && <SubscriptionForm data={data} lookups={lookups} initialPlanId={params.get('plan')} initialTemplateId={params.get('template')} onClose={close} onCreated={(subscription) => setParams({ view: subscription.id }, { replace: true })} />}
    </div>
  );
}
