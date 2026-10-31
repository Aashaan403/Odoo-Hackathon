import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { lineTotal, useApiMutation, useLookups, useWorkspace } from '../lib/api.js';
import { formatDate, intervalLabel, money } from '../lib/format.js';
import { Button } from '../components/Button.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Drawer } from '../components/Drawer.jsx';
import { Field, FormGrid, Input } from '../components/Field.jsx';
import { DetailList, Loading, PageHeader, SearchInput, Section, Toolbar } from '../components/Layout.jsx';
import { StatusTag } from '../components/StatusTag.jsx';

function CustomerForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' });
  const create = useApiMutation({ onSuccess: onCreated });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return (
    <Drawer open onClose={onClose} kicker="Customers" title="Add customer"
      footer={<><Button type="submit" form="customer-form" busy={create.isPending}>Add customer</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></>}>
      <form id="customer-form" className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); create.mutate({ path: '/customers', body: form, success: `${form.company || form.name} added.` }); }}>
        <FormGrid>
          <Field label="Contact name"><Input value={form.name} onChange={set('name')} required autoComplete="off" /></Field>
          <Field label="Company" hint="Optional"><Input value={form.company} onChange={set('company')} /></Field>
          <Field label="Email" hint="One customer per email address"><Input type="email" value={form.email} onChange={set('email')} required /></Field>
          <Field label="Phone" hint="Optional"><Input type="tel" value={form.phone} onChange={set('phone')} /></Field>
        </FormGrid>
      </form>
    </Drawer>
  );
}

function CustomerDrawer({ customer, rows, onClose }) {
  return (
    <Drawer open onClose={onClose} kicker={customer.name} title={customer.company || customer.name} wide>
      <div className="flex flex-col gap-10">
        <DetailList items={[['Email', customer.email], ['Phone', customer.phone || '—'], ['Customer since', formatDate(customer.createdAt)], ['Active subscriptions', customer.activeCount], ['Billed to date', money(customer.billed)], ['Balance due', money(customer.balance)]]} />
        <Section title="Subscriptions">
          <ul className="border-t border-ink">
            {rows.subscriptions.map((item) => (
              <li key={item.id} className="border-b border-line">
                <Link to={`/subscriptions?view=${item.id}`} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-4 py-3 text-body hover:bg-plum-wash">
                  <span className="font-semibold tabular-nums">{item.number}</span>
                  <span className="flex flex-wrap items-center gap-x-4"><span>{item.plan?.name}</span><StatusTag status={item.status} /></span>
                  <span className="tabular-nums">{money(lineTotal(item.lines))}<span className="text-mute"> / {intervalLabel[item.plan?.interval]}</span></span>
                </Link>
              </li>
            ))}
            {!rows.subscriptions.length && <li className="py-4 text-body text-mute">No subscriptions yet.</li>}
          </ul>
        </Section>
        <Section title="Recent invoices">
          <ul className="border-t border-ink">
            {rows.invoices.slice(0, 8).map((invoice) => (
              <li key={invoice.id} className="border-b border-line">
                <Link to={`/invoices?view=${invoice.id}`} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-4 py-3 text-body hover:bg-plum-wash">
                  <span className="font-semibold tabular-nums">{invoice.number}</span>
                  <span className="flex flex-wrap items-center gap-x-4"><span className="text-mute tabular-nums">{formatDate(invoice.issueDate)}</span><StatusTag status={invoice.status} /></span>
                  <span className="tabular-nums">{money(invoice.total)}</span>
                </Link>
              </li>
            ))}
            {!rows.invoices.length && <li className="py-4 text-body text-mute">No invoices yet.</li>}
          </ul>
        </Section>
      </div>
    </Drawer>
  );
}

export default function Customers() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const customers = useMemo(() => {
    if (!data) return [];
    const stats = new Map(data.customers.map((customer) => [customer.id, { subscriptions: [], invoices: [] }]));
    for (const item of data.subscriptions) stats.get(item.customerId)?.subscriptions.push(item);
    for (const invoice of data.invoices) stats.get(invoice.customerId)?.invoices.push(invoice);
    return data.customers.map((customer) => {
      const related = stats.get(customer.id);
      related.invoices.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
      return { ...customer, related, activeCount: related.subscriptions.filter((item) => item.status === 'Active').length, billed: related.invoices.reduce((sum, invoice) => sum + invoice.total, 0), balance: related.invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0), overdue: related.invoices.some((invoice) => invoice.status === 'Overdue') };
    });
  }, [data]);

  if (isLoading || !lookups) return <Loading />;
  const needle = query.trim().toLowerCase();
  const rows = customers.filter((customer) => !needle || [customer.name, customer.company, customer.email].some((value) => value?.toLowerCase().includes(needle)));
  const viewing = customers.find((customer) => customer.id === params.get('view'));
  const close = () => setParams({}, { replace: true });

  const columns = [
    { key: 'company', header: 'Customer', render: (row) => <><span className="block font-semibold">{row.company || row.name}</span><span className="block text-caption text-mute">{row.name}</span></> },
    { key: 'email', header: 'Email', render: (row) => <span className="text-mute">{row.email}</span> },
    { key: 'active', header: 'Active plans', align: 'right', render: (row) => <span className="tabular-nums">{row.activeCount}</span> },
    { key: 'billed', header: 'Billed to date', align: 'right', render: (row) => <span className="tabular-nums">{money(row.billed)}</span> },
    { key: 'balance', header: 'Balance due', align: 'right', render: (row) => <span className={`font-semibold tabular-nums ${row.overdue ? 'text-alarm' : row.balance ? '' : 'text-faint'}`}>{money(row.balance)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Customers" description="Everyone with a Brightloop account, what they pay for and what they owe." actions={<Button onClick={() => setParams({ new: '1' })}>Add customer</Button>} />
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, company or email" />
        <span className="text-body text-mute tabular-nums">{rows.length} customers</span>
      </Toolbar>
      <DataTable columns={columns} rows={rows} activeId={viewing?.id} onRowClick={(row) => setParams({ view: row.id })} empty="No customers match that search." />
      {viewing && <CustomerDrawer customer={viewing} rows={viewing.related} onClose={close} />}
      {params.get('new') && <CustomerForm onClose={close} onCreated={(customer) => setParams({ view: customer.id }, { replace: true })} />}
    </div>
  );
}
